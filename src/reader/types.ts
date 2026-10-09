import type { TapZone } from "../lib/reading";
import type { ZoomDirection } from "../lib/zoom";
import type { OutlineEntry } from "../engine/pdfEngine";
import type { PageText } from "../lib/textAnalysis";

/** One occurrence of a search term, with the text around it for the results list. */
export interface SearchHit {
  /** Where goTo takes the reader: a page number for PDF, a CFI for EPUB. */
  position: string;
  /** 1-based chapter number for EPUB, page number for PDF. */
  section: number;
  before: string;
  match: string;
  after: string;
}

export interface SearchOptions {
  signal: AbortSignal;
  onHit: (hit: SearchHit) => void;
  /** Share of the book scanned, from 0 to 1. */
  onProgress: (ratio: number) => void;
  /** Text read by recognition for pages with no text layer, keyed by page number. */
  ocrPages?: Record<string, string>;
}

export interface RecognizeOptions {
  signal: AbortSignal;
  onPage: (page: number, text: string) => void;
  onProgress: (ratio: number) => void;
}

/**
 * Moving through a book. A position is a string the format understands: a 1-based
 * page number for PDF, a CFI for EPUB.
 */
export interface ReaderNavigation {
  next(): void;
  previous(): void;
  /** Jumps to a stored position or a table-of-contents target. */
  goTo(target: string): void;
}

/** What the reader view can ask of any format: moving through the book and searching it. */
export interface ReaderHandle extends ReaderNavigation {
  /** Scans the whole book. Resolves when finished or when the signal aborts. */
  search(query: string, options: SearchOptions): Promise<void>;
  /** PDF only: the text layer of every page. */
  scanText?(options: { signal: AbortSignal; onProgress: (ratio: number) => void }): Promise<PageText[]>;
  /** PDF only: reads the given pages as images and reports the text of each one. */
  recognize?(pages: readonly number[], options: RecognizeOptions): Promise<void>;
}

export interface TocItem {
  label: string;
  depth: number;
  /** A position the handle's goTo understands, or null when the entry cannot be followed. */
  target: string | null;
}

export interface ReaderReadyInfo {
  toc: TocItem[];
  /** Total pages for PDF. EPUB reports 0 because its pagination depends on the screen. */
  totalPages: number;
}

export interface ReaderCallbacks {
  onReady: (info: ReaderReadyInfo) => void;
  onPosition: (position: string, progress: number) => void;
  onTap: (zone: TapZone) => void;
  onError: () => void;
  /** Wheel over the page: +1 zooms in, -1 zooms out. */
  onZoomStep: (direction: ZoomDirection) => void;
  /** Pointer over the book, as a distance from the window's left edge in CSS pixels. */
  onPointer: (clientX: number) => void;
}

export function pdfTocFromOutline(outline: OutlineEntry[]): TocItem[] {
  return outline.map((entry) => ({
    label: entry.label,
    depth: entry.depth,
    target: entry.pageIndex === null ? null : String(entry.pageIndex + 1),
  }));
}
