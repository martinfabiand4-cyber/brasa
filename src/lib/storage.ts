import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings";
import type { Book, Bookmark, LibraryData } from "./types";

/**
 * Everything the app keeps lives in one JSON document inside the app data folder,
 * and book files live beside it. Writes go to a temporary file first and then
 * replace the document, so a crash mid-save never leaves a half-written library.
 */
const LIBRARY_FILE = "library.json";
const TEMP_FILE = "library.json.tmp";
const BACKUP_FILE = "library.bak.json";
export const BOOKS_DIR = "books";

const DIR = { baseDir: BaseDirectory.AppData };

export function emptyLibrary(): LibraryData {
  return { version: 1, books: [], bookmarks: [], settings: { ...DEFAULT_SETTINGS } };
}

function parseLibrary(raw: string): LibraryData {
  const parsed = JSON.parse(raw) as Partial<LibraryData>;
  return {
    version: 1,
    books: Array.isArray(parsed.books) ? (parsed.books as Book[]) : [],
    bookmarks: Array.isArray(parsed.bookmarks) ? (parsed.bookmarks as Bookmark[]) : [],
    settings: sanitizeSettings(parsed.settings),
  };
}

/**
 * Loads the library. A damaged file is kept aside as a backup and the app starts
 * with an empty library instead of refusing to open.
 */
export async function loadLibrary(): Promise<{ data: LibraryData; recovered: boolean }> {
  await mkdir(BOOKS_DIR, { ...DIR, recursive: true });

  if (!(await exists(LIBRARY_FILE, DIR))) {
    return { data: emptyLibrary(), recovered: false };
  }

  try {
    const raw = await readTextFile(LIBRARY_FILE, DIR);
    return { data: parseLibrary(raw), recovered: false };
  } catch {
    await rename(LIBRARY_FILE, BACKUP_FILE, {
      oldPathBaseDir: BaseDirectory.AppData,
      newPathBaseDir: BaseDirectory.AppData,
    });
    return { data: emptyLibrary(), recovered: true };
  }
}

let writeChain: Promise<void> = Promise.resolve();

/** Saves are serialized so two quick changes never race each other on disk. */
export function saveLibrary(data: LibraryData): Promise<void> {
  const snapshot = JSON.stringify(data, null, 2);
  writeChain = writeChain.then(async () => {
    await writeTextFile(TEMP_FILE, snapshot, DIR);
    await rename(TEMP_FILE, LIBRARY_FILE, {
      oldPathBaseDir: BaseDirectory.AppData,
      newPathBaseDir: BaseDirectory.AppData,
    });
  });
  return writeChain;
}

/** Stores a book's bytes in the app's own books folder. */
export async function writeBookBytes(storedPath: string, bytes: Uint8Array): Promise<void> {
  await writeFile(storedPath, bytes, DIR);
}

export async function readBookBytes(storedPath: string): Promise<Uint8Array> {
  return readFile(storedPath, DIR);
}

export async function deleteBookFile(storedPath: string): Promise<void> {
  if (await exists(storedPath, DIR)) {
    await remove(storedPath, DIR);
  }
}
