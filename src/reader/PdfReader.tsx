import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdf, readPdfOutline, scanPdfText, searchPdf } from "../engine/pdfEngine";
import { recognizePdfPages } from "../engine/ocrEngine";
import { pdfProgress } from "../lib/reading";
import type { Flow, PageTurn } from "../lib/types";
import { createWheelZoom } from "../lib/zoom";
import PdfPaged from "./PdfPaged";
import PdfScrolled from "./PdfScrolled";
import { pdfTocFromOutline, type ReaderCallbacks, type ReaderHandle } from "./types";

interface PdfReaderProps extends ReaderCallbacks {
  ref?: Ref<ReaderHandle>;
  bytes: Uint8Array;
  initialPosition: string | null;
  flow: Flow;
  zoom: number;
  pageTurn: PageTurn;
}

/** Breathing room around the page, in CSS pixels (matches the stage padding). */
const PADDING_X = 48;
const PADDING_Y = 48;

export default function PdfReader({
  ref,
  bytes,
  initialPosition,
  flow,
  zoom,
  pageTurn,
  onReady,
  onPosition,
  onTap,
  onError,
  onZoomStep,
}: PdfReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<ReaderHandle | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;

  // Latest zoom callback and flow, read by the wheel listener, which is attached once.
  const zoomStep = useRef(onZoomStep);
  const flowRef = useRef(flow);
  useEffect(() => {
    zoomStep.current = onZoomStep;
    flowRef.current = flow;
  });
  // Page by page the wheel zooms on its own; while the pages scroll it needs Ctrl.
  const [onWheel] = useState(() =>
    createWheelZoom(
      (direction) => zoomStep.current(direction),
      () => flowRef.current === "scroll",
    ),
  );

  // Opening happens once per book. A cancelled load destroys its own document.
  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;

    openPdf(bytes)
      .then(async (pdf) => {
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        opened = pdf;
        const outline = await readPdfOutline(pdf);
        if (cancelled) return;
        // Set before the callbacks run, so a search started at once already sees the document.
        docRef.current = pdf;
        setDoc(pdf);
        onReady({ toc: pdfTocFromOutline(outline), totalPages: pdf.numPages });
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      docRef.current = null;
      if (opened) void opened.destroy();
    };
    // Callbacks are read at call time, so only the bytes decide when to reopen.
  }, [bytes]);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () =>
      setSize({
        width: Math.max(0, el.clientWidth - PADDING_X * 2),
        height: Math.max(0, el.clientHeight - PADDING_Y * 2),
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  useImperativeHandle(
    ref,
    () => ({
      next: () => innerRef.current?.next(),
      previous: () => innerRef.current?.previous(),
      goTo: (target: string) => innerRef.current?.goTo(target),
      search: (query, options) => {
        const current = docRef.current;
        if (!current) return Promise.resolve();
        return searchPdf(current, query, options);
      },
      scanText: (options) => {
        const current = docRef.current;
        return current ? scanPdfText(current, options) : Promise.resolve([]);
      },
      recognize: (pages, options) => {
        const current = docRef.current;
        return current ? recognizePdfPages(current, pages, options) : Promise.resolve();
      },
    }),
    [doc],
  );

  const initialPage = Number(initialPosition ?? 1) || 1;

  return (
    <div className="reader-body" ref={hostRef}>
      {doc && width > 0 ? (
        flow === "scroll" ? (
          <PdfScrolled
            ref={innerRef}
            doc={doc}
            initialPage={initialPage}
            width={width}
            zoom={zoom}
            onPosition={(page, total) => onPosition(String(page), pdfProgress(page, total))}
            onTap={onTap}
          />
        ) : (
          <PdfPaged
            ref={innerRef}
            doc={doc}
            initialPage={initialPage}
            width={width}
            height={height}
            zoom={zoom}
            pageTurn={pageTurn}
            onPosition={(page, total) => onPosition(String(page), pdfProgress(page, total))}
            onTap={onTap}
          />
        )
      ) : null}
    </div>
  );
}
