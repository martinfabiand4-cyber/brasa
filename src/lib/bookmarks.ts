import type { Bookmark, BookmarkDesign } from "./types";

export const BOOKMARK_DESIGNS: readonly BookmarkDesign[] = ["ribbon", "tag", "flag", "dot"];

/** Colors the person can pick for a bookmark. The first one is the default. */
export const BOOKMARK_COLORS: readonly string[] = [
  "#d42a44",
  "#e0a030",
  "#3fa36b",
  "#3b82d6",
  "#8a5cd6",
  "#e9e4e4",
];

export const DEFAULT_BOOKMARK_DESIGN: BookmarkDesign = "ribbon";
export const DEFAULT_BOOKMARK_COLOR = BOOKMARK_COLORS[0];

/** Fills in the design and color of bookmarks saved before they existed. */
export function normalizeBookmark(raw: Partial<Bookmark>): Bookmark {
  return {
    id: String(raw.id ?? ""),
    bookId: String(raw.bookId ?? ""),
    position: String(raw.position ?? ""),
    label: typeof raw.label === "string" ? raw.label : "",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
    design: BOOKMARK_DESIGNS.includes(raw.design as BookmarkDesign)
      ? (raw.design as BookmarkDesign)
      : DEFAULT_BOOKMARK_DESIGN,
    color: BOOKMARK_COLORS.includes(raw.color as string) ? (raw.color as string) : DEFAULT_BOOKMARK_COLOR,
  };
}
