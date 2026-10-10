import {
  ArrowLeft,
  BookmarkSimple,
  ChatCircleText,
  GearSix,
  Highlighter,
  ListBullets,
  MagnifyingGlass,
  NotePencil,
  Scan,
  Sun,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import BookmarkIcon from "../components/BookmarkIcon";
import BookmarkSheet, { type BookmarkValues } from "../components/BookmarkSheet";
import BrightnessPopover from "../components/BrightnessPopover";
import MarkerPanel, { type InkSettings } from "../components/MarkerPanel";
import OcrPanel from "../components/OcrPanel";
import ReaderDrawer, { type DrawerTab } from "../components/ReaderDrawer";
import SearchPanel, { type SearchStatus } from "../components/SearchPanel";
import SettingsPanel from "../components/SettingsPanel";
import ToolDock, { type DockItem } from "../components/ToolDock";
import { AnnotationProvider, type AnnotationScene } from "../components/annotations/AnnotationContext";
import StyleDesigner from "../components/annotations/StyleDesigner";
import ToolStash from "../components/annotations/ToolStash";
import { useI18n } from "../i18n/context";
import EpubReader from "../reader/EpubReader";
import PdfReader from "../reader/PdfReader";
import type { ReaderHandle, ReaderReadyInfo, SearchHit, TocItem } from "../reader/types";
import { DEFAULT_INK, positionIn, type StyleTemplate } from "../lib/annotations";
import { BOOKMARK_COLORS, DEFAULT_BOOKMARK_DESIGN } from "../lib/bookmarks";
import { percentOf, type TapZone } from "../lib/reading";
import { SEARCH_LIMIT } from "../lib/search";
import { ANALYSIS_DIR, readBookBytes } from "../lib/storage";
import { emptyAnalysis, normalizeAnalysis, type Heading } from "../lib/textAnalysis";
import { stepFontSize, stepZoom, type ZoomDirection } from "../lib/zoom";
import type { Book, Bookmark } from "../lib/types";
import { useAnnotations } from "../state/useAnnotations";
import { useSidecar } from "../state/useSidecar";
import type { LibraryActions } from "../state/useLibrary";

interface ReaderProps {
  book: Book;
  lib: LibraryActions;
  onBack: () => void;
}

type Panel = "drawer" | "search" | "bookmark" | "brightness" | "settings" | "note" | "comment" | "marker" | "ocr" | null;

/** How long the pointer rests on the right edge before the drawer opens. */
const EDGE_OPEN_DELAY_MS = 150;
/** How long the pointer may stay away from an edge-opened drawer before it closes. */
const DRAWER_CLOSE_DELAY_MS = 350;

interface SearchState {
  query: string;
  status: SearchStatus;
  progress: number;
  hits: SearchHit[];
  truncated: boolean;
}

interface DragState {
  template: StyleTemplate;
  x: number;
  y: number;
  moved: boolean;
}

const EMPTY_SEARCH: SearchState = { query: "", status: "idle", progress: 0, hits: [], truncated: false };
const EMPTY_ANALYSIS = emptyAnalysis();

/** The shortest term worth scanning a whole book for. */
const MIN_QUERY_LENGTH = 2;
/** Pointer movement, in pixels, before a press on a saved tool becomes a drag. */
const DRAG_SLOP = 4;
/** Within this many CSS pixels of the window's left edge, the hidden tools come back. */
const TOOLS_REVEAL_WIDTH = 120;
/** How long the hidden tools stay after the pointer leaves that edge. */
const TOOLS_HIDE_DELAY_MS = 900;

export default function Reader({ book, lib, onBack }: ReaderProps) {
  const { t } = useI18n();
  const handle = useRef<ReaderHandle | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const pendingSearch = useRef<string | null>(null);
  const searchRun = useRef<AbortController | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  // While the chrome is hidden, the pointer near the tool column brings it back for a moment.
  const [peeking, setPeeking] = useState(false);
  const peekTimer = useRef<number | null>(null);
  const cancelPeekHide = useCallback(() => {
    if (peekTimer.current === null) return;
    window.clearTimeout(peekTimer.current);
    peekTimer.current = null;
  }, []);
  const hidePeekSoon = useCallback(() => {
    if (peekTimer.current !== null) return;
    peekTimer.current = window.setTimeout(() => {
      peekTimer.current = null;
      setPeeking(false);
    }, TOOLS_HIDE_DELAY_MS);
  }, []);
  const revealNear = useCallback(
    (clientX: number) => {
      if (clientX <= TOOLS_REVEAL_WIDTH) {
        cancelPeekHide();
        setPeeking(true);
      } else {
        hidePeekSoon();
      }
    },
    [cancelPeekHide, hidePeekSoon],
  );
  useEffect(() => () => cancelPeekHide(), [cancelPeekHide]);
  const chromeShown = chromeVisible || peeking;
  const [panel, setPanel] = useState<Panel>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("contents");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [ink, setInk] = useState<InkSettings>({ color: DEFAULT_INK.color, style: DEFAULT_INK.style, size: DEFAULT_INK.size });
  const [drag, setDrag] = useState<DragState | null>(null);
  // A drawer opened from the right edge follows the pointer: it closes when the pointer leaves it,
  // unless the person clicks in it or opened it from the tool dock.
  const [drawerPeek, setDrawerPeek] = useState(false);
  const peekRef = useRef(false);
  const panelRef = useRef<Panel>(null);
  const drawerTimer = useRef<number | null>(null);

  const { settings } = lib;
  const bookmarks = lib.state.data.bookmarks.filter((m) => m.bookId === book.id);
  const editing = bookmarks.find((m) => m.id === editingId) ?? null;
  const percent = percentOf(book.progress);
  const pdfPage = book.format === "pdf" ? Number(book.position ?? 1) || 1 : null;
  const currentBookmark = book.position ? bookmarks.find((m) => m.position === book.position) ?? null : null;
  // Brightness works as a veil: 100 shows the page as it is, 30 dims it the most.
  const veil = ((100 - settings.brightness) / 100) * 0.8;

  // Notes, comments and ink live in a file of their own, per book.
  const annotations = useAnnotations(book.id);
  // Text analysis (which pages are images, their recognized text, the chapter index), also per book.
  const analysisFile = useSidecar(`${ANALYSIS_DIR}/${book.id}.json`, normalizeAnalysis);
  const analysis = analysisFile.value ?? EMPTY_ANALYSIS;
  const analysisRef = useRef(analysis);
  useEffect(() => {
    analysisRef.current = analysis;
  });

  const scene = useMemo<AnnotationScene | null>(
    () =>
      annotations.ready
        ? {
            annotations: annotations.annotations,
            strokes: annotations.strokes,
            ink: { active: panel === "marker", color: ink.color, style: ink.style, size: ink.size },
            store: annotations,
          }
        : null,
    [annotations, ink, panel],
  );

  // The page the reader is on. For EPUB it is the start of the page, for PDF the page number.
  const anchor = book.position;

  // Load the file's bytes once for this book.
  useEffect(() => {
    let cancelled = false;
    readBookBytes(book.storedPath)
      .then((data) => {
        if (!cancelled) setBytes(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [book.storedPath]);

  // Runs once per open: later updates must not bump the book's "recent" date.
  const { updateBook } = lib;
  useEffect(() => {
    updateBook(book.id, { lastOpenedAt: Date.now() });
  }, [book.id, updateBook]);

  // A search still running when the reader closes must stop.
  useEffect(() => () => searchRun.current?.abort(), []);

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  const clearDrawerTimer = useCallback(() => {
    if (drawerTimer.current !== null) window.clearTimeout(drawerTimer.current);
    drawerTimer.current = null;
  }, []);
  useEffect(() => clearDrawerTimer, [clearDrawerTimer]);

  const setPeek = useCallback((value: boolean) => {
    peekRef.current = value;
    setDrawerPeek(value);
  }, []);

  const closePanel = useCallback(() => {
    clearDrawerTimer();
    setPeek(false);
    setPanel(null);
  }, [clearDrawerTimer, setPeek]);

  // The pointer rests on the right edge: after a short pause the drawer opens over the page.
  const edgeEnter = useCallback(() => {
    clearDrawerTimer();
    drawerTimer.current = window.setTimeout(() => {
      drawerTimer.current = null;
      if (panelRef.current !== null) return;
      setPeek(true);
      setPanel("drawer");
    }, EDGE_OPEN_DELAY_MS);
  }, [clearDrawerTimer, setPeek]);

  // Leaving an edge-opened drawer closes it after a moment, so the pointer can come back to it.
  const drawerLeave = useCallback(() => {
    if (!peekRef.current) return;
    clearDrawerTimer();
    drawerTimer.current = window.setTimeout(() => {
      drawerTimer.current = null;
      if (!peekRef.current) return;
      setPeek(false);
      setPanel(null);
    }, DRAWER_CLOSE_DELAY_MS);
  }, [clearDrawerTimer, setPeek]);

  // A click in the drawer keeps it open after the pointer leaves.
  const drawerPin = useCallback(() => {
    clearDrawerTimer();
    setPeek(false);
  }, [clearDrawerTimer, setPeek]);

  // Keyboard navigation for the reader. The EPUB frame reports its own keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Escape finishes the marker: it closes the panel and stops drawing.
      if (panel === "marker" && event.key === "Escape") {
        setPanel(null);
        return;
      }
      if (panel) return;
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      // Escape first closes an open note, so leaving the book is a second press.
      if (event.key === "Escape" && annotations.hasOpen()) {
        annotations.collapseAll();
        return;
      }
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          handle.current?.next();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          handle.current?.previous();
          break;
        case "m":
        case "M":
          setChromeVisible((visible) => !visible);
          break;
        case "Escape":
          onBack();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, onBack, annotations]);

  const runSearch = useCallback((query: string) => {
    searchRun.current?.abort();
    searchRun.current = null;
    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setSearch({ ...EMPTY_SEARCH, query });
      return;
    }
    if (!ready.current) {
      // The book is still opening: the search starts as soon as it is ready.
      pendingSearch.current = query;
      setSearch({ query, status: "searching", progress: 0, hits: [], truncated: false });
      return;
    }

    const controller = new AbortController();
    const hits: SearchHit[] = [];
    let truncated = false;
    searchRun.current = controller;
    setSearch({ query, status: "searching", progress: 0, hits: [], truncated: false });

    const scan =
      handle.current?.search(term, {
        signal: controller.signal,
        ocrPages: analysisRef.current.pages,
        onHit: (hit) => {
          if (controller.signal.aborted) return;
          hits.push(hit);
          if (hits.length >= SEARCH_LIMIT) {
            truncated = true;
            controller.abort();
          }
          setSearch((prev) => (prev.query === query ? { ...prev, hits: [...hits] } : prev));
        },
        onProgress: (ratio) => {
          if (controller.signal.aborted) return;
          setSearch((prev) => (prev.query === query ? { ...prev, progress: ratio } : prev));
        },
      }) ?? Promise.resolve();

    void scan
      .catch(() => undefined)
      .finally(() => {
        // A newer search has replaced this one: leave its state alone.
        if (searchRun.current !== controller) return;
        searchRun.current = null;
        setSearch((prev) => (prev.query === query ? { ...prev, status: "done", progress: 1, truncated } : prev));
      });
  }, []);

  function handleTap(zone: TapZone) {
    // A click outside an open note only closes it, so it never also turns the page.
    if (annotations.hasOpen()) {
      annotations.collapseAll();
      return;
    }
    // While the marker is drawing, a press is a stroke, not a page turn.
    if (panel === "marker") return;
    if (zone === "previous") handle.current?.previous();
    else if (zone === "next") handle.current?.next();
    else setChromeVisible((visible) => !visible);
  }

  function handleReady(info: ReaderReadyInfo) {
    ready.current = true;
    setToc(info.toc);
    setTotalPages(info.totalPages);
    const pending = pendingSearch.current;
    if (pending !== null) {
      pendingSearch.current = null;
      runSearch(pending);
    }
  }

  function handlePosition(position: string, progress: number) {
    lib.updateBook(book.id, { position, progress });
  }

  function handleZoomStep(direction: ZoomDirection) {
    if (book.format === "pdf") lib.updateSettings({ zoom: stepZoom(settings.zoom, direction) });
    else lib.updateSettings({ fontSize: stepFontSize(settings.fontSize, direction) });
  }

  function openDrawer(tab: DrawerTab) {
    clearDrawerTimer();
    setPeek(false);
    setDrawerTab(tab);
    setPanel("drawer");
  }

  function openBookmark(bookmarkId: string | null) {
    setEditingId(bookmarkId);
    setPanel("bookmark");
  }

  function saveBookmark(values: BookmarkValues) {
    if (editing) lib.updateBookmark(editing.id, values);
    else if (book.position) lib.addBookmark({ bookId: book.id, position: book.position, ...values });
    closePanel();
  }

  function removeEditingBookmark() {
    if (editing) lib.removeBookmark(editing.id);
    closePanel();
  }

  function goToHit(hit: SearchHit) {
    handle.current?.goTo(hit.position);
    closePanel();
  }

  /** One bookmark per chapter heading, skipping pages that already have one. */
  function addHeadingBookmarks(headings: Heading[]): number {
    const taken = new Set(bookmarks.map((m) => m.position));
    let added = 0;
    for (const heading of headings) {
      const position = String(heading.page);
      if (taken.has(position)) continue;
      taken.add(position);
      lib.addBookmark({
        bookId: book.id,
        position,
        label: heading.label,
        design: DEFAULT_BOOKMARK_DESIGN,
        color: BOOKMARK_COLORS[0],
      });
      added += 1;
    }
    return added;
  }

  function saveTemplate(template: StyleTemplate) {
    lib.addTemplate(template);
    closePanel();
  }

  function bookmarkTitle(bookmark: Bookmark, index: number): string {
    return bookmark.label || t("bookmarkDefaultName", { n: index + 1 });
  }

  function bookmarkDetail(bookmark: Bookmark): string | null {
    return book.format === "pdf" ? t("pageOf", { page: bookmark.position, total: totalPages || "?" }) : null;
  }

  function describeHit(hit: SearchHit): string {
    return book.format === "pdf"
      ? t("pageOf", { page: hit.section, total: totalPages || "?" })
      : t("sectionOf", { n: hit.section });
  }

  // Chapters from the file when it has them; for scanned PDFs, the ones found in the text.
  const contentsToc: TocItem[] =
    toc.length > 0 || book.format !== "pdf"
      ? toc
      : analysis.headings.map((heading) => ({ label: heading.label, depth: heading.depth, target: String(heading.page) }));

  // --- Saved tools: a press on a saved note or comment, dragged onto the page. ---

  /** The page element under a point on screen, if a page of this book is there. */
  function pageAt(clientX: number, clientY: number): HTMLElement | null {
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const host = element instanceof HTMLElement ? element.closest<HTMLElement>("[data-ann-anchor]") : null;
      if (host && stageRef.current?.contains(host)) return host;
    }
    return null;
  }

  function placeTemplate(template: StyleTemplate, host: HTMLElement, clientX: number, clientY: number) {
    const anchorValue = host.dataset.annAnchor;
    if (!anchorValue || !annotations.ready) return;
    const place = positionIn(clientX, clientY, host.getBoundingClientRect());
    annotations.add({
      kind: template.kind,
      design: template.design,
      color: template.color,
      typography: template.typography,
      anchor: anchorValue,
      x: place.x,
      y: place.y,
    });
  }

  /** A press without a move places the tool in the middle of the page on screen. */
  function placeInView(template: StyleTemplate) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const host =
      pageAt(rect.left + rect.width / 2, rect.top + rect.height / 2) ?? stage.querySelector<HTMLElement>("[data-ann-anchor]");
    if (!host) return;
    const box = host.getBoundingClientRect();
    placeTemplate(template, host, box.left + box.width / 2, box.top + box.height * 0.35);
  }

  function startDrag(template: StyleTemplate, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    // Capturing the pointer keeps the move and release events even above the EPUB frame.
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    setDrag({ template, x: startX, y: startY, moved: false });

    const onMove = (move: globalThis.PointerEvent) => {
      setDrag((current) =>
        current
          ? {
              ...current,
              x: move.clientX,
              y: move.clientY,
              moved: current.moved || Math.hypot(move.clientX - startX, move.clientY - startY) > DRAG_SLOP,
            }
          : current,
      );
    };
    const onEnd = (end: globalThis.PointerEvent) => {
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onEnd);
      grip.removeEventListener("pointercancel", onEnd);
      setDrag(null);
      if (end.type === "pointercancel") return;
      const moved = Math.hypot(end.clientX - startX, end.clientY - startY) > DRAG_SLOP;
      if (!moved) {
        placeInView(template);
        return;
      }
      const host = pageAt(end.clientX, end.clientY);
      if (host) placeTemplate(template, host, end.clientX, end.clientY);
    };
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onEnd);
    grip.addEventListener("pointercancel", onEnd);
  }

  const failed = loadFailed || openFailed;
  const positionLabel =
    book.format === "pdf" && totalPages > 0
      ? t("pageOf", { page: pdfPage ?? 1, total: totalPages })
      : `${percent} %`;

  const toggle = (id: Panel) => setPanel((current) => (current === id ? null : id));

  const dockItems: DockItem[] = [
    {
      id: "contents",
      label: t("contents"),
      icon: <ListBullets size={20} aria-hidden="true" />,
      active: panel === "drawer" && drawerTab === "contents",
      onSelect: () => openDrawer("contents"),
    },
    {
      id: "search",
      label: t("dockSearch"),
      icon: <MagnifyingGlass size={20} aria-hidden="true" />,
      active: panel === "search",
      onSelect: () => setPanel("search"),
    },
    {
      id: "bookmark",
      label: t("dockBookmark"),
      icon: currentBookmark ? (
        <BookmarkIcon design={currentBookmark.design} color={currentBookmark.color} size={20} />
      ) : (
        <BookmarkSimple size={20} aria-hidden="true" />
      ),
      active: panel === "bookmark",
      onSelect: () => openBookmark(currentBookmark?.id ?? null),
    },
    {
      id: "note",
      label: t("toolNote"),
      icon: <NotePencil size={20} aria-hidden="true" />,
      active: panel === "note",
      onSelect: () => toggle("note"),
    },
    {
      id: "comment",
      label: t("toolComment"),
      icon: <ChatCircleText size={20} aria-hidden="true" />,
      active: panel === "comment",
      onSelect: () => toggle("comment"),
    },
    {
      id: "marker",
      label: t("toolMarker"),
      icon: <Highlighter size={20} aria-hidden="true" />,
      active: panel === "marker",
      onSelect: () => toggle("marker"),
    },
    ...(book.format === "pdf"
      ? [
          {
            id: "ocr",
            label: t("toolOcr"),
            icon: <Scan size={20} aria-hidden="true" />,
            active: panel === "ocr",
            onSelect: () => toggle("ocr"),
          },
        ]
      : []),
    {
      id: "brightness",
      label: t("dockBrightness"),
      icon: <Sun size={20} aria-hidden="true" />,
      active: panel === "brightness",
      onSelect: () => toggle("brightness"),
    },
    {
      id: "settings",
      label: t("settings"),
      icon: <GearSix size={20} aria-hidden="true" />,
      active: panel === "settings",
      onSelect: () => setPanel("settings"),
    },
  ];

  return (
    <div
      className={`reader${chromeShown ? " reader--chrome" : ""}`}
      onPointerMove={(event) => {
        if (!chromeVisible) revealNear(event.clientX);
      }}
      onPointerLeave={() => {
        if (!chromeVisible) hidePeekSoon();
      }}
    >
      <header className="reader__top">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t("back")}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="reader__title">{book.title}</h1>
      </header>

      <ToolDock label={t("dockLabel")} items={dockItems}>
        <ToolStash label={t("savedTools")} templates={lib.state.data.templates} onPress={startDrag} />
      </ToolDock>

      {panel === null ? (
        <div className="drawer-edge" aria-hidden="true" onPointerEnter={edgeEnter} onPointerLeave={clearDrawerTimer} />
      ) : null}

      <AnnotationProvider value={scene}>
        <main className="reader__stage" ref={stageRef}>
          {failed ? (
            <div className="reader__message" role="alert">
              <p>{loadFailed ? t("missingFile") : t("openFailed")}</p>
              <button type="button" className="button" onClick={onBack}>
                {t("back")}
              </button>
            </div>
          ) : bytes === null ? (
            <div className="reader__message" aria-busy="true">
              <p>{t("loadingBook")}</p>
            </div>
          ) : book.format === "pdf" ? (
            <PdfReader
              ref={handle}
              bytes={bytes}
              initialPosition={book.position}
              flow={settings.flow}
              zoom={settings.zoom}
              pageTurn={settings.pageTurn}
              onReady={handleReady}
              onPosition={handlePosition}
              onTap={handleTap}
              onError={() => setOpenFailed(true)}
              onZoomStep={handleZoomStep}
              onPointer={revealNear}
            />
          ) : (
            <EpubReader
              ref={handle}
              bytes={bytes}
              initialPosition={book.position}
              anchor={anchor}
              flow={settings.flow}
              theme={settings.theme}
              fontSize={settings.fontSize}
              pageTurn={settings.pageTurn}
              onReady={handleReady}
              onPosition={handlePosition}
              onTap={handleTap}
              onError={() => setOpenFailed(true)}
              onZoomStep={handleZoomStep}
              onPointer={revealNear}
            />
          )}
          {failed ? null : <div className="reader__dim" style={{ opacity: veil }} aria-hidden="true" />}
        </main>
      </AnnotationProvider>

      <footer className="reader__bottom">
        <div
          className="reader__progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("progressLabel", { percent })}
        >
          <span style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
        <span className="reader__position">{positionLabel}</span>
      </footer>

      {drag?.moved ? (
        <div className="ann-ghost" style={{ left: drag.x, top: drag.y, background: drag.template.color }} aria-hidden="true" />
      ) : null}

      {panel === "drawer" ? (
        <ReaderDrawer
          tab={drawerTab}
          onTabChange={setDrawerTab}
          toc={contentsToc}
          bookmarks={bookmarks}
          onGo={(target) => {
            handle.current?.goTo(target);
            closePanel();
          }}
          onEditBookmark={(id) => openBookmark(id)}
          onRemoveBookmark={(id) => lib.removeBookmark(id)}
          bookmarkTitle={bookmarkTitle}
          bookmarkDetail={bookmarkDetail}
          onClose={closePanel}
          peek={drawerPeek}
          onPointerEnter={clearDrawerTimer}
          onPointerLeave={drawerLeave}
          onPointerDown={drawerPin}
        />
      ) : null}

      {panel === "search" ? (
        <SearchPanel
          query={search.query}
          status={search.status}
          progress={search.progress}
          hits={search.hits}
          truncated={search.truncated}
          describe={describeHit}
          onSearch={runSearch}
          onGo={goToHit}
          onClose={closePanel}
        />
      ) : null}

      {panel === "bookmark" ? (
        <BookmarkSheet
          key={editing?.id ?? "new"}
          initial={editing}
          defaultName={t("bookmarkDefaultName", { n: bookmarks.length + 1 })}
          onSave={saveBookmark}
          onRemove={removeEditingBookmark}
          onClose={closePanel}
        />
      ) : null}

      {panel === "note" || panel === "comment" ? (
        <StyleDesigner
          key={panel}
          kind={panel}
          saved={lib.state.data.templates}
          onSave={saveTemplate}
          onRemove={(id) => lib.removeTemplate(id)}
          onClose={closePanel}
        />
      ) : null}

      {panel === "marker" ? (
        <MarkerPanel
          ink={ink}
          onChange={(patch) => setInk((current) => ({ ...current, ...patch }))}
          onUndo={() => annotations.undoStroke()}
          onClearPage={() => {
            if (anchor) annotations.clearStrokes(anchor);
          }}
          onClose={closePanel}
        />
      ) : null}

      {panel === "ocr" && book.format === "pdf" ? (
        <OcrPanel
          reader={handle}
          totalPages={totalPages}
          analysis={analysis}
          onAnalysis={analysisFile.update}
          onAddBookmarks={addHeadingBookmarks}
          onGo={(page) => {
            handle.current?.goTo(String(page));
            closePanel();
          }}
          onClose={closePanel}
        />
      ) : null}

      {panel === "brightness" ? (
        <BrightnessPopover
          value={settings.brightness}
          onChange={(brightness) => lib.updateSettings({ brightness })}
          onClose={closePanel}
        />
      ) : null}

      {panel === "settings" ? <SettingsPanel lib={lib} onClose={closePanel} /> : null}
    </div>
  );
}

