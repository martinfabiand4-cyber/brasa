import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type Ref,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { renderPage } from "../engine/pdfEngine";
import AnnotationLayer from "../components/annotations/AnnotationLayer";
import { createTurnRunner, type TurnDirection } from "../lib/animateTurn";
import { clampPage, tapZoneFor, type TapZone } from "../lib/reading";
import { ZOOM_MIN } from "../lib/zoom";
import { restoreZoomAnchor, type ZoomAnchor } from "../lib/zoomAnchor";
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
  /** The zoom step waiting to keep its spot under the pointer, if one started. */
  zoomAnchor: RefObject<ZoomAnchor | null>;
  pageTurn: PageTurn;
  onPosition: (page: number, total: number) => void;
  onTap: (zone: TapZone) => void;
}

/** Pointer movement, in pixels, before a press counts as a pan rather than a tap. */
const PAN_SLOP = 4;
/** Side padding of the stage, in CSS pixels (matches the CSS). */
const STAGE_PADDING_X = 48;

/**
 * A page narrower than the window is placed so the spot under the pointer stays there while
 * it zooms. At fit size, and for a page wider than the window, the page stays where it is.
 */
function placeAtPointer(stage: HTMLElement, page: HTMLElement, anchor: ZoomAnchor | null, zoom: number): void {
  page.style.marginLeft = "";
  if (!anchor || zoom <= ZOOM_MIN) return;
  const pageWidth = page.offsetWidth;
  if (pageWidth >= stage.clientWidth - STAGE_PADDING_X * 2) return;
  const wanted = anchor.x - stage.getBoundingClientRect().left - anchor.fx * pageWidth;
  const left = Math.min(Math.max(wanted, STAGE_PADDING_X), stage.clientWidth - STAGE_PADDING_X - pageWidth);
  page.style.marginLeft = `${left - STAGE_PADDING_X}px`;
}

/**
 * One page at a time, centered and fitted to the window: as wide as possible
 * without losing any of its height. A single canvas is redrawn for each page,
 * so the page turn animation has one stable element to move. Zoomed in, the page
 * can be dragged to see the rest of it.
 */
export default function PdfPaged({
  ref,
  doc,
  initialPage,
  width,
  height,
  zoom,
  zoomAnchor,
  pageTurn,
  onPosition,
  onTap,
}: PdfPagedProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef(clampPage(initialPage, doc.numPages));
  // The page on screen, as state, so notes and ink for it are shown when the page changes.
  const [shown, setShown] = useState(current.current);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const renderTask = useRef<RenderTask | null>(null);
  const latest = useRef(0);
  const turnPreference = useRef(pageTurn);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  // Set when a press became a pan, so the click that ends it does not also turn the page.
  const panned = useRef(false);
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
      const cssWidth = fitWidth * zoom;
      // The new size reaches the DOM before the anchor is restored, so the restore sees the final layout.
      flushSync(() =>
        setPageSize({ width: Math.floor(cssWidth), height: Math.floor((natural.height * cssWidth) / natural.width) }),
      );
      renderTask.current?.cancel();
      const task = renderPage(page, canvas, fitWidth, zoom);
      renderTask.current = task;
      const anchor = zoomAnchor.current;
      zoomAnchor.current = null;
      const stage = stageRef.current;
      const pageElement = turnRef.current;
      const pending = anchor && anchor.from !== zoom ? anchor : null;
      if (stage && pageElement) {
        placeAtPointer(stage, pageElement, pending, zoom);
        if (pending) restoreZoomAnchor(stage, pending);
      }
      try {
        await task.promise;
      } catch {
        // Cancelled by a newer draw, which is expected.
      }
    },
    [doc, width, height, zoom, zoomAnchor],
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
        setShown(next);
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

  // Dragging moves a zoomed page. Notes, comments and the marker keep their own pointer work.
  function startPan(event: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage || zoom <= 1 || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".ann-item, .ann-layer--drawing")) return;
    pan.current = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    panned.current = false;
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const start = pan.current;
    const stage = stageRef.current;
    if (!start || !stage) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!panned.current && Math.hypot(dx, dy) < PAN_SLOP) return;
    panned.current = true;
    stage.scrollLeft = start.left - dx;
    stage.scrollTop = start.top - dy;
  }

  function endPan() {
    pan.current = null;
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (panned.current) {
      panned.current = false;
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    onTap(tapZoneFor(event.clientX - rect.left, rect.width));
  }

  return (
    <div
      className={`pdf-stage${zoom > 1 ? " pdf-stage--pannable" : ""}`}
      ref={stageRef}
      onClick={handleClick}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div className="pdf-page" ref={turnRef} data-ann-anchor={String(shown)}>
        <canvas ref={canvasRef} className="pdf-page__canvas" />
        <AnnotationLayer anchor={String(shown)} width={pageSize.width} height={pageSize.height} />
      </div>
    </div>
  );
}
