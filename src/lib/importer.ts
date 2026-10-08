import { readFile } from "@tauri-apps/plugin-fs";
import { openEpub, readEpubMetadata } from "../engine/epubEngine";
import { openPdf, readPdfMetadata } from "../engine/pdfEngine";
import { baseName, createId, detectFormat, hueFromString, titleFromFileName } from "./format";
import { sha256Hex } from "./hash";
import { deleteBookFile, writeBookBytes } from "./storage";
import type { Book } from "./types";

export type ImportErrorReason = "unsupported" | "unreadable" | "duplicate";

export class ImportError extends Error {
  constructor(public readonly reason: ImportErrorReason, public readonly fileName: string) {
    super(reason);
  }
}

export interface ImportOptions {
  now?: number;
  /** True when a book with the same content is already in the library. */
  isDuplicate: (contentHash: string) => boolean;
}

/**
 * Reads a book into the library. The content is hashed before anything is
 * written, so duplicates are refused without creating files. A damaged EPUB or
 * a protected PDF fails here, at import time, instead of showing up broken later.
 */
export async function importBook(sourcePath: string, options: ImportOptions): Promise<Book> {
  const fileName = baseName(sourcePath);
  const format = detectFormat(fileName);
  if (!format) throw new ImportError("unsupported", fileName);

  let bytes: Uint8Array;
  try {
    bytes = await readFile(sourcePath);
  } catch {
    throw new ImportError("unreadable", fileName);
  }

  const contentHash = await sha256Hex(bytes);
  if (options.isDuplicate(contentHash)) throw new ImportError("duplicate", fileName);

  const id = createId();
  const storedPath = `books/${id}.${format}`;
  await writeBookBytes(storedPath, bytes);

  try {
    const fallbackTitle = titleFromFileName(fileName);
    const meta =
      format === "pdf"
        ? await pdfMetadata(bytes)
        : await epubMetadata(bytes);
    return buildBook({
      id,
      fileName,
      format,
      storedPath,
      contentHash,
      now: options.now ?? Date.now(),
      title: meta.title ?? fallbackTitle,
      author: meta.author,
    });
  } catch {
    await deleteBookFile(storedPath);
    throw new ImportError("unreadable", fileName);
  }
}

/** Some damaged files never settle instead of failing, so reading is time-boxed. */
const METADATA_TIMEOUT_MS = 10_000;

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("metadata timeout")), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function pdfMetadata(bytes: Uint8Array) {
  const doc = await withTimeout(openPdf(bytes), METADATA_TIMEOUT_MS);
  try {
    return await withTimeout(readPdfMetadata(doc), METADATA_TIMEOUT_MS);
  } finally {
    await doc.destroy();
  }
}

async function epubMetadata(bytes: Uint8Array) {
  const book = openEpub(bytes);
  try {
    return await withTimeout(readEpubMetadata(book), METADATA_TIMEOUT_MS);
  } finally {
    book.destroy();
  }
}

function buildBook(input: {
  id: string;
  fileName: string;
  format: Book["format"];
  storedPath: string;
  contentHash: string;
  now: number;
  title: string;
  author: string | null;
}): Book {
  return {
    id: input.id,
    title: input.title,
    author: input.author ?? "",
    format: input.format,
    fileName: input.fileName,
    storedPath: input.storedPath,
    contentHash: input.contentHash,
    addedAt: input.now,
    lastOpenedAt: null,
    favorite: false,
    progress: 0,
    position: null,
    hue: hueFromString(input.title),
  };
}
