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
import { normalizeBookmark } from "./bookmarks";
import { normalizeTemplate, type StyleTemplate } from "./annotations";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings";
import type { LibraryData } from "./types";

/**
 * Everything the app keeps lives in one JSON document inside the app data folder,
 * and book files live beside it. Writes go to a temporary file first and then
 * replace the document, so a crash mid-save never leaves a half-written library.
 */
const LIBRARY_FILE = "library.json";
const TEMP_FILE = "library.json.tmp";
const BACKUP_FILE = "library.bak.json";
export const BOOKS_DIR = "books";
export const COVERS_DIR = "covers";
/** Per-book notes and ink, and per-book text analysis, each kept in its own file. */
export const NOTES_DIR = "notes";
export const ANALYSIS_DIR = "analysis";

const DIR = { baseDir: BaseDirectory.AppData };

export function emptyLibrary(): LibraryData {
  return { version: 1, books: [], bookmarks: [], templates: [], settings: { ...DEFAULT_SETTINGS } };
}

function parseLibrary(raw: string): LibraryData {
  const parsed = JSON.parse(raw) as Partial<LibraryData>;
  return {
    version: 1,
    books: Array.isArray(parsed.books) ? parsed.books : [],
    bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks.map(normalizeBookmark) : [],
    templates: Array.isArray(parsed.templates)
      ? parsed.templates.map(normalizeTemplate).filter((item): item is StyleTemplate => item !== null)
      : [],
    settings: sanitizeSettings(parsed.settings),
  };
}

/**
 * Loads the library. A damaged file is kept aside as a backup and the app starts
 * with an empty library instead of refusing to open.
 */
export async function loadLibrary(): Promise<{ data: LibraryData; recovered: boolean }> {
  await mkdir(BOOKS_DIR, { ...DIR, recursive: true });
  await mkdir(COVERS_DIR, { ...DIR, recursive: true });

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

/** Reads a stored cover as a URL the page can show. The caller revokes it when done. */
export async function readCoverUrl(coverPath: string): Promise<string> {
  const bytes = await readFile(coverPath, DIR);
  const type = sniffImageType(bytes);
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
}

/** Covers are stored as JPEG, PNG, GIF or WebP; the type comes from the file's first bytes. */
export function sniffImageType(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  return "image/jpeg";
}

export function coverFileName(bookId: string, bytes: Uint8Array): string {
  const type = sniffImageType(bytes);
  const ext = type === "image/png" ? "png" : type === "image/gif" ? "gif" : type === "image/webp" ? "webp" : "jpg";
  return `${COVERS_DIR}/${bookId}.${ext}`;
}

/** Reads a per-book file. A damaged one is kept aside as ".bak" so nothing the person wrote is lost. */
export async function readSidecar(path: string): Promise<unknown | null> {
  if (!(await exists(path, DIR))) return null;
  try {
    return JSON.parse(await readTextFile(path, DIR)) as unknown;
  } catch {
    await rename(path, `${path}.bak`, {
      oldPathBaseDir: BaseDirectory.AppData,
      newPathBaseDir: BaseDirectory.AppData,
    });
    return null;
  }
}

let sidecarChain: Promise<void> = Promise.resolve();

/** Writes a per-book file through a temporary file, serialized with other per-book writes. */
export function writeSidecar(path: string, data: unknown): Promise<void> {
  const snapshot = JSON.stringify(data);
  const folder = path.slice(0, path.lastIndexOf("/"));
  sidecarChain = sidecarChain.then(async () => {
    await mkdir(folder, { ...DIR, recursive: true });
    await writeTextFile(`${path}.tmp`, snapshot, DIR);
    await rename(`${path}.tmp`, path, {
      oldPathBaseDir: BaseDirectory.AppData,
      newPathBaseDir: BaseDirectory.AppData,
    });
  });
  return sidecarChain;
}

/** Removes everything kept for one book besides the book itself. */
export async function removeSidecars(bookId: string): Promise<void> {
  for (const folder of [NOTES_DIR, ANALYSIS_DIR]) {
    const path = `${folder}/${bookId}.json`;
    if (await exists(path, DIR)) await remove(path, DIR);
  }
}
