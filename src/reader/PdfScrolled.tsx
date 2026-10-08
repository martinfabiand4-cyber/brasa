import { useEffect, useImperativeHandle, useMemo, useRef, useState, type MouseEvent, type Ref } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { pageCssSize, renderPage } from "../engine/pdfEngine";
import AnnotationLayer from "../components/annotations/AnnotationLayer";
import { clampPage, tapZoneFor, type TapZone } from "../lib/reading";
import type { ReaderNavigation } from "./types";

interface PdfScrolledProps {
  ref?: Ref<ReaderNavigation>;
  doc: PDFDocumentProxy;
  initialPage: number;
  width: number;
  zoom: number;
  onPosition: (page: number, total: number) => void;
  onTap: (zone: TapZone) => void;
}

const GAP = 24;
/** Pages within this distance of the viewport are drawn; the rest are released. */
const KEEP_MARGIN = "1200px 0px";

interface Size {
  width: number;
  height: number;
}

/**
 * Continuous vertical reading. Every page keeps its space so the scrollbar and
 * positions stay exact, but only pages near the viewport own a canvas.
 */
export default function PdfScrolled({ ref, doc, initialPage, width, zoom, onPosition, onTap }: PdfScrolledProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvases = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const tasks = useRef<Map<number, RenderTask>>(new Map());
  const lastReported = useRef(clampPage(initialPage, doc.numPages) - 1);
  const [sizes, setSizes] = useState<Size[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list: Size[] = [];
      for (let i = 1; i <= doc.numPages; i += 1) {
        const page = await doc.getPage(i);
        list.push(await pageCssSize(page, width, zoom));
        if (cancelled) return;
      }
      if (!cancelled) setSizes(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, width, zoom]);

  const offsets = useMemo(() => {
    const out: number[] = [];
    let top = GAP;
    for (const size of sizes) {
      out.push(top);
      top += size.height + GAP;
    }
    return out;
  }, [sizes]);

  // Keep the reader on the same page while the layout changes size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || offsets.length === 0) return;
    el.scrollTop = offsets[lastReported.current] ?? 0;
  }, [offsets]);

  // Draw pages as they approach the viewport and release them when they leave it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || sizes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting) {
            void drawAt(index);
          } else {
            release(index);
          }
        }
      },
      { root: el, rootMargin: KEEP_MARGIN },
    );

    const drawAt = async (index: number) => {
      const canvas = canvases.current.get(index);
      if (!canvas || tasks.current.has(index)) return;
      const page = await doc.getPage(index + 1);
      if (!canvases.current.has(index)) return;
      const task = renderPage(page, canvas, width, zoom);
      tasks.current.set(index, task);
      try {
        await task.promise;
      } catch {
        // Released before it finished; nothing to do.
      } finally {
        if (tasks.current.get(index) === task) tasks.current.delete(index);
      }
    };

    const release = (index: number) => {
      tasks.current.get(index)?.cancel();
      tasks.current.delete(index);
      const canvas = canvases.current.get(index);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };

    el.querySelectorAll<HTMLElement>("[data-index]").forEach((node) => observer.observe(node));
    const taskMap = tasks.current;
    return () => {
      observer.disconnect();
      taskMap.forEach((task) => task.cancel());
      taskMap.clear();
    };
  }, [doc, sizes, width, zoom]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el || offsets.length === 0) return;
    const probe = el.scrollTop + el.clientHeight * 0.4;
    let index = 0;
    for (let i = 0; i < offsets.length; i += 1) {
      if (offsets[i] <= probe) index = i;
      else break;
    }
    if (index !== lastReported.current) {
      lastReported.current = index;
      onPosition(index + 1, doc.numPages);
    }
  }

  function scrollToPage(page: number) {
    const el = containerRef.current;
    if (!el || offsets.length === 0) return;
    const index = clampPage(page, doc.numPages) - 1;
    el.scrollTo({ top: offsets[index] ?? 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  useImperativeHandle(
    ref,
    () => ({
      next: () => {
        const el = containerRef.current;
        el?.scrollBy({ top: el.clientHeight * 0.9, behavior: reducedMotion() ? "auto" : "smooth" });
      },
      previous: () => {
        const el = containerRef.current;
        el?.scrollBy({ top: -el.clientHeight * 0.9, behavior: reducedMotion() ? "auto" : "smooth" });
      },
      goTo: (target: string) => {
        const page = Number(target);
        if (Number.isFinite(page)) scrollToPage(page);
      },
    }),
    [offsets, doc],
  );

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onTap(tapZoneFor(event.clientX - rect.left, rect.width));
  }

  return (
    <div className="pdf-scroll" ref={containerRef} onScroll={handleScroll} onClick={handleClick}>
      {sizes.map((size, index) => (
        <div
          key={index}
          className="pdf-scroll__page"
          data-index={index}
          data-ann-anchor={String(index + 1)}
          style={{ width: size.width, height: size.height }}
        >
          <canvas
            className="pdf-page__canvas"
            ref={(node) => {
              if (node) canvases.current.set(index, node);
              else canvases.current.delete(index);
            }}
          />
          <AnnotationLayer anchor={String(index + 1)} width={size.width} height={size.height} />
        </div>
      ))}
    </div>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
