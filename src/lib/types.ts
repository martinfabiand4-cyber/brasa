export type BookFormat = "epub" | "pdf";

export type SortMode = "alphabetical" | "recentlyOpened" | "recentlyAdded";

export type Theme = "noche" | "papel";

export type PageTurn = "slide" | "fade" | "none";

export type Flow = "paginated" | "scroll";

export type Locale = "auto" | "es" | "en";

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  /** Name of the file as the person chose it, kept for display only. */
  fileName: string;
  /** Path relative to the app data folder, e.g. "books/abc.epub". */
  storedPath: string;
  /** SHA-256 of the file content, used to refuse duplicate imports. Absent on older libraries. */
  contentHash?: string;
  addedAt: number;
  lastOpenedAt: number | null;
  favorite: boolean;
  /** Reading progress from 0 to 1. */
  progress: number;
  /** EPUB: CFI string. PDF: page number as a string, starting at "1". */
  position: string | null;
  /** Hue used to draw the generated cover, 0 to 359. */
  hue: number;
  /** Real cover image, relative to the app data folder, when the book has one. */
  coverPath?: string;
}

export type BookmarkDesign = "ribbon" | "tag" | "flag" | "dot";

export interface Bookmark {
  id: string;
  bookId: string;
  position: string;
  /** The name the person gave it. */
  label: string;
  createdAt: number;
  design: BookmarkDesign;
  /** A color from the bookmark palette, as a hex value. */
  color: string;
}

export interface Settings {
  locale: Locale;
  theme: Theme;
  /** Last sort order chosen in the library, remembered between sessions. */
  sort: SortMode;
  pageTurn: PageTurn;
  flow: Flow;
  /** EPUB text size as a percentage, 70 to 200. */
  fontSize: number;
  /** PDF zoom multiplier, 0.6 to 3. */
  zoom: number;
  /** Screen dimming for the reading area, 30 (dimmest) to 100 (full light). */
  brightness: number;
}

export interface LibraryData {
  version: 1;
  books: Book[];
  bookmarks: Bookmark[];
  settings: Settings;
}
