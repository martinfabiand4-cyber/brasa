import { createWorker } from "tesseract.js";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { tidyOcrText } from "../lib/textAnalysis";

/**
 * Reads the text of pages that are only images. Recognition runs inside the app
 * with the Spanish and English data it ships with, so it needs no connection.
 */

/** Pages are drawn this wide before recognition, about 250 dots per inch on a letter-size page. */
const OCR_WIDTH = 1800;
/** Engine mode: the neural recognizer alone, the most accurate one Tesseract offers. */
const LSTM_ONLY = 1;

export interface RecognizeOptions {
  signal: AbortSignal;
  /** Called after each page, so a long book is saved as it is read. */
  onPage: (page: number, text: string) => void;
  /** Share of the pages done, from 0 to 1. */
  onProgress: (ratio: number) => void;
}

/** Paths are absolute, because the recognition worker resolves them from its own address. */
function workerOptions() {
  const base = new URL("ocr/", document.baseURI).href;
  return {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: `${base}lang`,
    gzip: true,
    workerBlobURL: false,
    cacheMethod: "none",
  };
}

/** Draws one page on a white canvas, which is what the recognizer expects. */
async function drawPage(doc: PDFDocumentProxy, pageNumber: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  try {
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: OCR_WIDTH / natural.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas;
  } finally {
    page.cleanup();
  }
}

/**
 * Reads the given pages one by one. Stopping is immediate: the worker is shut down
 * as soon as the signal aborts, and pages already read have been reported.
 */
export async function recognizePdfPages(
  doc: PDFDocumentProxy,
  pages: readonly number[],
  options: RecognizeOptions,
): Promise<void> {
  if (pages.length === 0) return;
  const worker = await createWorker("spa+eng", LSTM_ONLY, workerOptions());
  const stop = () => {
    void worker.terminate().catch(() => undefined);
  };
  options.signal.addEventListener("abort", stop, { once: true });

  try {
    for (const [index, pageNumber] of pages.entries()) {
      if (options.signal.aborted) break;
      const canvas = await drawPage(doc, pageNumber);
      const result = await worker.recognize(canvas);
      if (options.signal.aborted) break;
      options.onPage(pageNumber, tidyOcrText(result.data.text));
      options.onProgress((index + 1) / pages.length);
    }
  } catch (error) {
    // The stop above ends the worker, which makes the pending call fail. That is not an error.
    if (!options.signal.aborted) throw error;
  } finally {
    options.signal.removeEventListener("abort", stop);
    await worker.terminate().catch(() => undefined);
  }
}
