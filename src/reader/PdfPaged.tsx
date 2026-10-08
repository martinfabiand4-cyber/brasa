import { useCallback, useEffect, useImperativeHandle, useRef, useState, type MouseEvent, type Ref } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { renderPage } from "../engine/pdfEngine";
import { createTurnRunner, type TurnDirection } from "../lib/animateTurn";
import { clampPage, tapZoneFor, type TapZone } from "../lib/reading";
import type { PageTurn } from "../lib/types";
import type { ReaderNavigation } from "./types";

interface PdfPagedProps {
  ref?: Ref<ReaderNavigation>;
  doc: PDFDocumentProxy;
  initialPage: number;
  /** Width and height in CSS pixels available for the page. */
  width: number;
  height: number;
  zoom: number;
  pageTurn: PageTurn;
  onPosition: (page: number, total: number) => void;
  onTap: (zone: TapZone) => void;
}

/**
 * One page at a time, centered and fitted to the window: as wide as possible
 * without losing any of its height. A single canvas is redrawn for each page,
 * so the page turn animation has one stable element to move.
 */
export default function PdfPaged({
  ref,
  doc,
  initialPage,
  width,
  height,
  zoom,
  pageTurn,
  onPosition,
  onTap,
}: PdfPagedProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef(clampPage(initialPage, doc.numPages));
  const renderTask = useRef<RenderTask | null>(null);
  const latest = useRef(0);
  const turnPreference = useRef(pageTurn);
  const [runTurn] = useState(() =>
    createTurnRunner(
      () => turnRef.current,
      () => turnPreference.current,
    ),
  );

  useEffect(() => {
    turnPreference.current = pageTurn;
  }, [pageTurn]);

  const draw = useCallback(
    async (target: number) => {
      const canvas = canvasRef.current;
      if (!canvas || width <= 0 || height <= 0) return;
      const id = ++latest.current;
      const page = await doc.getPage(target);
      // A newer request started while this page was loading: let it win.
      if (id !== latest.current) return;
      // Width that keeps the whole page inside the available height.
      const natural = page.getViewport({ scale: 1 });
      const fitWidth = Math.min(width, height * (natural.width / natural.height));
      renderTask.current?.cancel();
      const task = renderPage(page, canvas, fitWidth, zoom);
      renderTask.current = task;
      try {
        await task.promise;
      } catch {
        // Cancelled by a newer draw, which is expected.
      }
    },
    [doc, width, height, zoom],
  );

  // Redraw when the width or zoom changes, and once the first size is known.
  useEffect(() => {
    void draw(current.current);
  }, [draw]);

  // Reports the starting page once per document.
  useEffect(() => {
    onPosition(current.current, doc.numPages);
  }, [doc]);

  const go = useCallback(
    (target: number, direction: TurnDirection) => {
      const next = clampPage(target, doc.numPages);
      if (next === current.current) return;
      void runTurn(direction, async () => {
        current.current = next;
        await draw(next);
        onPosition(next, doc.numPages);
      });
    },
    [doc, draw, onPosition, runTurn],
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => go(current.current + 1, "next"),
      previous: () => go(current.current - 1, "previous"),
      goTo: (target: string) => {
        const page = Number(target);
        if (!Number.isFinite(page)) return;
        const clamped = clampPage(page, doc.numPages);
        go(clamped, clamped > current.current ? "next" : "previous");
      },
    }),
    [doc, go],
  );

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    onTap(tapZoneFor(event.clientX - rect.left, rect.width));
  }

  return (
    <div className="pdf-stage" ref={stageRef} onClick={handleClick}>
      <div className="pdf-page" ref={turnRef}>
        <canvas ref={canvasRef} className="pdf-page__canvas" />
      </div>
    </div>
  );
}
