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
}

export interface Bookmark {
  id: string;
  bookId: string;
  position: string;
  label: string;
  createdAt: number;
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
}

export interface LibraryData {
  version: 1;
  books: Book[];
  bookmarks: Bookmark[];
  settings: Settings;
}
