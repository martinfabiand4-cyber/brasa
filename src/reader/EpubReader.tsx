import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { Book, Rendition } from "epubjs";
import {
  applyReadingStyle,
  closeEpub,
  createRendition,
  generateLocations,
  openEpub,
  readEpubToc,
  readSpineLength,
  searchEpub,
} from "../engine/epubEngine";
import AnnotationLayer from "../components/annotations/AnnotationLayer";
import { REFERENCE_WIDTH } from "../lib/annotations";
import { createTurnRunner, type TurnDirection } from "../lib/animateTurn";
import type { Flow, PageTurn, Theme } from "../lib/types";
import { createWheelZoom } from "../lib/zoom";
import { type ReaderCallbacks, type ReaderHandle } from "./types";

interface EpubReaderProps extends ReaderCallbacks {
  ref?: Ref<ReaderHandle>;
  bytes: Uint8Array;
  initialPosition: string | null;
  flow: Flow;
  theme: Theme;
  fontSize: number;
  pageTurn: PageTurn;
  /** The start of the page on screen, which notes and ink are attached to. */
  anchor: string | null;
}

/**
 * EPUB pages are computed by the rendering engine for the current size and text
 * settings, so a change of flow rebuilds the renderer and returns to the same
 * place in the text.
 */
export default function EpubReader({
  ref,
  bytes,
  initialPosition,
  flow,
  theme,
  fontSize,
  pageTurn,
  anchor,
  onReady,
  onPosition,
  onTap,
  onError,
  onZoomStep,
}: EpubReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const lastPosition = useRef<string | null>(initialPosition);
  const spineCount = useRef(0);

  // Latest callbacks and preferences, read by engine handlers that outlive a render.
  const live = useRef({ pageTurn, onTap, onPosition, onReady, onError, onZoomStep, flow });
  useEffect(() => {
    live.current = { pageTurn, onTap, onPosition, onReady, onError, onZoomStep, flow };
  });

  const [runTurn] = useState(() =>
    createTurnRunner(
      () => hostRef.current,
      () => live.current.pageTurn,
    ),
  );

  // One wheel handler for the whole reader. Page by page it zooms on its own; while the text scrolls it needs Ctrl.
  const [onWheel] = useState(() =>
    createWheelZoom(
      (direction) => live.current.onZoomStep(direction),
      () => live.current.flow === "scroll",
    ),
  );

  const turn = useCallback(
    (direction: TurnDirection) =>
      runTurn(direction, async () => {
        const current = renditionRef.current;
        if (!current) return;
        if (direction === "next") await current.next();
        else await current.prev();
      }),
    [runTurn],
  );

  // Open the book once per file and report its table of contents.
  useEffect(() => {
    let cancelled = false;
    const opened = openEpub(bytes);

    opened.ready
      .then(async () => {
        const [entries, chapters] = await Promise.all([readEpubToc(opened), readSpineLength(opened)]);
        if (cancelled) return;
        spineCount.current = chapters;
        bookRef.current = opened;
        setBook(opened);
        live.current.onReady({
          toc: entries.map((entry) => ({ label: entry.label, depth: entry.depth, target: entry.href })),
          totalPages: 0,
        });
        void generateLocations(opened).catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) live.current.onError();
      });

    return () => {
      cancelled = true;
      bookRef.current = null;
      closeEpub(opened);
    };
  }, [bytes]);

  // Build the renderer for the open book. Rebuilt when the flow changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!book || !host) return;

    const next = createRendition(
      book,
      host,
      { flow, theme, fontSize, spineCount: spineCount.current },
      {
        onTap: (zone) => live.current.onTap(zone),
        onKey: (direction) => void turn(direction),
        onPosition: ({ cfi, progress }) => {
          lastPosition.current = cfi;
          live.current.onPosition(cfi, progress);
        },
        onWheel,
      },
    );

    renditionRef.current = next;
    setRendition(next);
    next.display(lastPosition.current ?? undefined).catch(() => live.current.onError());

    return () => {
      next.destroy();
      renditionRef.current = null;
      setRendition(null);
    };
    // Theme and size changes are applied in place below; only structure rebuilds here.
  }, [book, flow, onWheel]);

  useEffect(() => {
    if (rendition) applyReadingStyle(rendition, theme, fontSize);
  }, [rendition, theme, fontSize]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !rendition) return;
    const observer = new ResizeObserver(() => {
      rendition.resize(host.clientWidth, host.clientHeight);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [rendition]);

  // The annotation layer covers the reader body, so it is measured the same way.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setFrameSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Wheel over the edge zones, which sit above the frame and catch the wheel first.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  useImperativeHandle(
    ref,
    () => ({
      next: () => void turn("next"),
      previous: () => void turn("previous"),
      goTo: (target: string) => {
        const current = renditionRef.current;
        if (current) void current.display(target).catch(() => undefined);
      },
      search: (query, options) => {
        const current = bookRef.current;
        if (!current) return Promise.resolve();
        return searchEpub(current, query, options);
      },
    }),
    [turn],
  );

  // The engine renders into its own element; React only owns the sibling zones.
  // Edge zones sit above the frame so page turns work even where a frame does
  // not deliver clicks (WebKitGTK), and they keep working in every engine.
  return (
    <div className="reader-body" ref={bodyRef}>
      <div className="reader-frame" ref={hostRef} data-ann-anchor={anchor ?? undefined} />
      {flow === "paginated" && (
        <>
          <div className="reader-edge reader-edge--previous" aria-hidden="true" onClick={() => onTap("previous")} />
          <div className="reader-edge reader-edge--next" aria-hidden="true" onClick={() => onTap("next")} />
        </>
      )}
      {anchor ? (
        <AnnotationLayer
          anchor={anchor}
          width={frameSize.width}
          height={frameSize.height}
          // The frame fills the window, so notes are sized to a book's page width instead.
          scale={Math.min(frameSize.width, REFERENCE_WIDTH)}
        />
      ) : null}
    </div>
  );
}
