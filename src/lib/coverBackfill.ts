import { saveCover } from "./importer";
import { readBookBytes } from "./storage";
import type { Book } from "./types";

/** Only one pass runs at a time, even when effects are replayed. */
let running = false;

/**
 * Books imported before covers existed get one now. Files are read one at a time,
 * so a large library never has more than one book in memory. A book without a
 * usable cover keeps its generated one.
 */
export async function backfillCovers(
  books: Book[],
  onCover: (bookId: string, coverPath: string) => void,
): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const book of books) {
      if (book.coverPath) continue;
      try {
        const bytes = await readBookBytes(book.storedPath);
        const coverPath = await saveCover(book.id, bytes, book.format);
        if (coverPath) onCover(book.id, coverPath);
      } catch {
        // A missing or damaged file keeps its generated cover.
      }
    }
  } finally {
    running = false;
  }
}
