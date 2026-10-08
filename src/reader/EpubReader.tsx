import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Book, Rendition } from "epubjs";
import {
  applyReadingStyle,
  createRendition,
  generateLocations,
  openEpub,
  readEpubToc,
  readSpineLength,
} from "../engine/epubEngine";
import { createTurnRunner, type TurnDirection } from "../lib/animateTurn";
import type { Flow, PageTurn, Theme } from "../lib/types";
import { type ReaderCallbacks, type ReaderHandle } from "./types";

interface EpubReaderProps extends ReaderCallbacks {
  ref?: Ref<ReaderHandle>;
  bytes: Uint8Array;
  initialPosition: string | null;
  flow: Flow;
  theme: Theme;
  fontSize: number;
  pageTurn: PageTurn;
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
  onReady,
  onPosition,
  onTap,
  onError,
}: EpubReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const lastPosition = useRef<string | null>(initialPosition);
  const spineCount = useRef(0);

  // Latest callbacks and preferences, read by engine handlers that outlive a render.
  const live = useRef({ pageTurn, onTap, onPosition, onReady, onError });
  useEffect(() => {
    live.current = { pageTurn, onTap, onPosition, onReady, onError };
  });

  const [runTurn] = useState(() =>
    createTurnRunner(
      () => hostRef.current,
      () => live.current.pageTurn,
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
      opened.destroy();
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
  }, [book, flow]);

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

  useImperativeHandle(
    ref,
    () => ({
      next: () => void turn("next"),
      previous: () => void turn("previous"),
      goTo: (target: string) => {
        const current = renditionRef.current;
        if (current) void current.display(target).catch(() => undefined);
      },
    }),
    [turn],
  );

  // The engine renders into its own element; React only owns the sibling zones.
  // Edge zones sit above the frame so page turns work even where a frame does
  // not deliver clicks (WebKitGTK), and they keep working in every engine.
  return (
    <div className="reader-body">
      <div className="reader-frame" ref={hostRef} />
      {flow === "paginated" && (
        <>
          <div className="reader-edge reader-edge--previous" aria-hidden="true" onClick={() => onTap("previous")} />
          <div className="reader-edge reader-edge--next" aria-hidden="true" onClick={() => onTap("next")} />
        </>
      )}
    </div>
  );
}
