import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { findMatches } from "../lib/search";
import { needsOcr, type PageText } from "../lib/textAnalysis";
import type { SearchOptions } from "../reader/types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfMetadata {
  title: string | null;
  author: string | null;
}

export interface OutlineEntry {
  label: string;
  depth: number;
  /** Zero-based page index the entry points to, or null when it cannot be resolved. */
  pageIndex: number | null;
}

/**
 * Opens a PDF from memory. pdf.js detaches the buffer it receives, so we pass a
 * copy and keep the original bytes intact for later reads.
 */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const task = pdfjs.getDocument({ data: bytes.slice() });
  return task.promise;
}

export async function readPdfMetadata(doc: PDFDocumentProxy): Promise<PdfMetadata> {
  const { info } = await doc.getMetadata();
  const data = info as { Title?: unknown; Author?: unknown } | undefined;
  const clean = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return { title: clean(data?.Title), author: clean(data?.Author) };
}

/** Flattens the PDF outline into a list with indentation depth and resolved pages. */
export async function readPdfOutline(doc: PDFDocumentProxy): Promise<OutlineEntry[]> {
  const outline = await doc.getOutline();
  if (!outline) return [];

  const entries: OutlineEntry[] = [];
  const walk = async (items: NonNullable<typeof outline>, depth: number) => {
    for (const item of items) {
      let pageIndex: number | null = null;
      try {
        const destination = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
        if (Array.isArray(destination) && destination[0]) {
          pageIndex = await doc.getPageIndex(destination[0]);
        }
      } catch {
        pageIndex = null;
      }
      entries.push({ label: item.title || "…", depth, pageIndex });
      if (item.items?.length) await walk(item.items, depth + 1);
    }
  };

  await walk(outline, 0);
  return entries;
}

/**
 * Draws a page onto a canvas. The canvas is sized for the device pixel ratio so
 * text stays sharp on high-density screens. The returned task can be cancelled
 * when the page scrolls out of view or the zoom changes.
 */
export function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  zoom: number,
): RenderTask {
  const base = cssWidth / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale: base * zoom });
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");

  return page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [dpr, 0, 0, dpr, 0, 0],
  });
}

/** CSS size a page will occupy at the given width and zoom, without rendering it. */
export async function pageCssSize(
  page: PDFPageProxy,
  cssWidth: number,
  zoom: number,
): Promise<{ width: number; height: number }> {
  const base = cssWidth / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale: base * zoom });
  return { width: Math.floor(viewport.width), height: Math.floor(viewport.height) };
}

/** The text layer of one page, with line breaks where the page has them. */
export async function readPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    return content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join("");
  } finally {
    page.cleanup();
  }
}

/** Reads the text layer of every page, for headings and for finding the pages that are only images. */
export async function scanPdfText(
  doc: PDFDocumentProxy,
  options: { signal: AbortSignal; onProgress: (ratio: number) => void },
): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    if (options.signal.aborted) break;
    let text = "";
    try {
      text = await readPageText(doc, page);
    } catch {
      // A page with a broken text layer counts as having no text.
    }
    pages.push({ page, text });
    options.onProgress(page / doc.numPages);
  }
  return pages;
}

/**
 * Scans every page in order. A page with no text layer is searched through the
 * text recognition read for it earlier, when there is one.
 */
export async function searchPdf(doc: PDFDocumentProxy, query: string, options: SearchOptions): Promise<void> {
  for (let page = 1; page <= doc.numPages; page++) {
    if (options.signal.aborted) return;
    try {
      const layer = await readPageText(doc, page);
      const text = needsOcr(layer) ? (options.ocrPages?.[String(page)] ?? layer) : layer;
      for (const match of findMatches(text, query)) {
        if (options.signal.aborted) return;
        options.onHit({ position: String(page), section: page, before: match.before, match: match.match, after: match.after });
      }
    } catch {
      // A page that cannot be read is skipped; the rest of the document is still searched.
    }
    options.onProgress(page / doc.numPages);
  }
}
