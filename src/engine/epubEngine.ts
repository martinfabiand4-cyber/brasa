import Epub from "epubjs";
import type { Book, Contents, Location, NavItem, Rendition } from "epubjs";
import { tapZoneFor, type TapZone } from "../lib/reading";
import { findMatches } from "../lib/search";
import type { Flow, Theme } from "../lib/types";
import type { SearchOptions } from "../reader/types";

export interface EpubMetadata {
  title: string | null;
  author: string | null;
}

export interface TocEntry {
  label: string;
  depth: number;
  href: string;
}

export interface EpubPosition {
  cfi: string;
  /** Share of the book read, from 0 to 1. Based on spine position until locations are ready. */
  progress: number;
}

export interface EpubHandlers {
  onTap: (zone: TapZone) => void;
  onKey: (key: "next" | "previous") => void;
  onPosition: (position: EpubPosition) => void;
  /** Wheel inside the book's frame, so Ctrl + wheel can zoom the text. */
  onWheel: (event: WheelEvent) => void;
  /** Pointer movement inside the frame, in window coordinates. */
  onPointer: (clientX: number) => void;
}

/** The parts of an epub.js spine section this module uses. The package's typings leave them out. */
interface SpineSection {
  document: Document;
  load(request: unknown): unknown;
  unload(): void;
  cfiFromRange(range: Range): string;
}

/** Colors inside the reading frame. These mirror the app themes in the design tokens. */
const READING_THEMES: Record<Theme, Record<string, Record<string, string>>> = {
  noche: {
    body: { background: "#120B0C", color: "#EFE6E4" },
    a: { color: "#E8717F" },
  },
  papel: {
    body: { background: "#F2F4F7", color: "#1C1F24" },
    a: { color: "#B3122E" },
  },
};

export function openEpub(bytes: Uint8Array): Book {
  return Epub(bytes.slice().buffer);
}

/**
 * Closes a book. epub.js keeps reading its own navigation state for a moment after
 * the book opens, so the close waits for that to settle instead of breaking it.
 */
export function closeEpub(book: Book): void {
  void book.loaded.navigation
    .then(
      () => undefined,
      () => undefined,
    )
    .then(() => book.destroy());
}

export async function readEpubMetadata(book: Book): Promise<EpubMetadata> {
  const metadata = await book.loaded.metadata;
  const clean = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return { title: clean(metadata.title), author: clean(metadata.creator) };
}

function flattenToc(items: NavItem[], depth: number, out: TocEntry[]): void {
  for (const item of items) {
    out.push({ label: item.label.trim() || "…", depth, href: item.href });
    if (item.subitems?.length) flattenToc(item.subitems, depth + 1, out);
  }
}

export async function readEpubToc(book: Book): Promise<TocEntry[]> {
  const navigation = await book.loaded.navigation;
  const entries: TocEntry[] = [];
  flattenToc(navigation.toc, 0, entries);
  return entries;
}

/** Number of chapters in reading order, used for an estimate before locations exist. */
export async function readSpineLength(book: Book): Promise<number> {
  const items = await book.loaded.spine;
  return items.length;
}

export function createRendition(
  book: Book,
  element: HTMLElement,
  options: { flow: Flow; theme: Theme; fontSize: number; spineCount: number },
  handlers: EpubHandlers,
): Rendition {
  const rendition = book.renderTo(element, {
    width: "100%",
    height: "100%",
    flow: options.flow === "scroll" ? "scrolled-doc" : "paginated",
    spread: "none",
  });

  rendition.themes.register("noche", READING_THEMES.noche);
  rendition.themes.register("papel", READING_THEMES.papel);
  rendition.themes.select(options.theme);
  rendition.themes.fontSize(`${options.fontSize}%`);

  // Clicks and keys inside the book's frame never reach the outer document,
  // so the frame reports them back through its own listeners.
  rendition.hooks.content.register((contents: Contents) => {
    const doc = contents.document;
    const win = doc.defaultView;
    doc.addEventListener("click", (event: MouseEvent) => {
      const selection = win?.getSelection();
      if (selection && !selection.isCollapsed) return;
      const width = win?.innerWidth ?? element.clientWidth;
      handlers.onTap(tapZoneFor(event.clientX, width));
    });
    doc.addEventListener("wheel", handlers.onWheel, { passive: false });
    doc.addEventListener("mousemove", (event: MouseEvent) => {
      handlers.onPointer(element.getBoundingClientRect().left + event.clientX);
    });
    doc.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        handlers.onKey("next");
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        handlers.onKey("previous");
      }
    });
  });

  rendition.on("relocated", (location: Location) => {
    handlers.onPosition({
      cfi: location.start.cfi,
      progress: progressOf(book, location, options.spineCount),
    });
  });

  return rendition;
}

/**
 * Exact progress once locations are generated, otherwise an estimate from the
 * chapter index that still moves from the first chapter to the last.
 */
function progressOf(book: Book, location: Location, spineCount: number): number {
  if (book.locations.length() > 0) {
    const exact = book.locations.percentageFromCfi(location.start.cfi);
    if (Number.isFinite(exact)) return Math.min(1, Math.max(0, exact));
  }
  if (spineCount <= 0) return 0;
  return Math.min(1, (location.start.index + 0.5) / spineCount);
}

export function applyReadingStyle(rendition: Rendition, theme: Theme, fontSize: number): void {
  rendition.themes.select(theme);
  rendition.themes.fontSize(`${fontSize}%`);
}

/** Builds locations in the background so percentages become exact. */
export async function generateLocations(book: Book): Promise<void> {
  await book.ready;
  await book.locations.generate(1600);
}

export interface EpubSearchHit {
  position: string;
  section: number;
  before: string;
  match: string;
  after: string;
}

/**
 * Scans every chapter in reading order. Each chapter is loaded on its own and
 * released again, so a long book never holds more than one chapter in memory.
 */
export async function searchEpub(book: Book, query: string, options: SearchOptions): Promise<void> {
  await book.loaded.spine;
  const sections: SpineSection[] = [];
  book.spine.each((section: SpineSection) => {
    sections.push(section);
  });

  for (const [index, section] of sections.entries()) {
    if (options.signal.aborted) return;
    try {
      await section.load(book.load.bind(book));
      const doc = section.document;
      const root = doc?.body ?? doc?.documentElement;
      if (doc && root) {
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement?.tagName;
          if (parent === "SCRIPT" || parent === "STYLE") continue;
          const text = node.textContent ?? "";
          for (const match of findMatches(text, query)) {
            if (options.signal.aborted) return;
            const range = doc.createRange();
            range.setStart(node, match.start);
            range.setEnd(node, match.end);
            options.onHit({
              position: section.cfiFromRange(range),
              section: index + 1,
              before: match.before,
              match: match.match,
              after: match.after,
            });
          }
        }
      }
    } catch {
      // A chapter that cannot be read is skipped; the rest of the book is still searched.
    } finally {
      section.unload();
    }
    options.onProgress((index + 1) / sections.length);
  }
}
