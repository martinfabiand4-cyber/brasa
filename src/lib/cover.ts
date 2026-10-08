import { closeEpub, openEpub } from "../engine/epubEngine";
import { openPdf, renderPage } from "../engine/pdfEngine";
import type { BookFormat } from "./types";

/** A cover is optional: a slow or unreadable one must never block an import. */
const COVER_TIMEOUT_MS = 10_000;
const PDF_COVER_WIDTH = 480;

function withTimeout<T>(task: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("cover timeout")), COVER_TIMEOUT_MS);
    task.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** True for the raster formats the library can show; SVG covers are skipped. */
function isRaster(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, 12));
  return (
    (bytes[0] === 0xff && bytes[1] === 0xd8) ||
    head.startsWith("\x89PNG") ||
    head.startsWith("GIF8") ||
    (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP")
  );
}

/**
 * The book's own cover: the EPUB's cover image, or the first page of a PDF.
 * Returns null when the book has none, so the library falls back to a generated cover.
 */
export async function extractCover(bytes: Uint8Array, format: BookFormat): Promise<Uint8Array | null> {
  try {
    const cover = await withTimeout(format === "pdf" ? pdfCover(bytes) : epubCover(bytes));
    return cover && isRaster(cover) ? cover : null;
  } catch {
    return null;
  }
}

async function epubCover(bytes: Uint8Array): Promise<Uint8Array | null> {
  const book = openEpub(bytes);
  try {
    const url = await book.coverUrl();
    if (!url) return null;
    const response = await fetch(url);
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    closeEpub(book);
  }
}

async function pdfCover(bytes: Uint8Array): Promise<Uint8Array | null> {
  const doc = await openPdf(bytes);
  try {
    const page = await doc.getPage(1);
    const canvas = document.createElement("canvas");
    await renderPage(page, canvas, PDF_COVER_WIDTH, 1).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } finally {
    await doc.destroy();
  }
}
