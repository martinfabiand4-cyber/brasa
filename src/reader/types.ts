import type { TapZone } from "../lib/reading";
import type { OutlineEntry } from "../engine/pdfEngine";

/**
 * What the reader view can ask of any format. A position is a string the format
 * understands: a 1-based page number for PDF, a CFI for EPUB.
 */
export interface ReaderHandle {
  next(): void;
  previous(): void;
  /** Jumps to a stored position or a table-of-contents target. */
  goTo(target: string): void;
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
}

export function pdfTocFromOutline(outline: OutlineEntry[]): TocItem[] {
  return outline.map((entry) => ({
    label: entry.label,
    depth: entry.depth,
    target: entry.pageIndex === null ? null : String(entry.pageIndex + 1),
  }));
}
