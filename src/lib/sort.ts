import type { Book, SortMode } from "./types";

/**
 * Sorts a copy of the books. Alphabetical ignores accents and case, so "Árbol"
 * lands between "Arbol" and "Azul" the way a reader expects.
 */
export function sortBooks(books: readonly Book[], mode: SortMode, locale: string): Book[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const copy = [...books];

  switch (mode) {
    case "alphabetical":
      return copy.sort((a, b) => collator.compare(a.title, b.title));
    case "recentlyOpened":
      // Books never opened fall back to their import date and go after opened ones.
      return copy.sort((a, b) => {
        const aKey = a.lastOpenedAt ?? -1;
        const bKey = b.lastOpenedAt ?? -1;
        if (aKey !== bKey) return bKey - aKey;
        return b.addedAt - a.addedAt;
      });
    case "recentlyAdded":
      return copy.sort((a, b) => b.addedAt - a.addedAt);
  }
}
