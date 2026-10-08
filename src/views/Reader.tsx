import { ArrowLeft, BookmarkSimple, GearSix, ListBullets, MagnifyingGlass, Sun } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import BookmarkIcon from "../components/BookmarkIcon";
import BookmarkSheet, { type BookmarkValues } from "../components/BookmarkSheet";
import BrightnessPopover from "../components/BrightnessPopover";
import ReaderDrawer, { type DrawerTab } from "../components/ReaderDrawer";
import SearchPanel, { type SearchStatus } from "../components/SearchPanel";
import SettingsPanel from "../components/SettingsPanel";
import ToolDock, { type DockItem } from "../components/ToolDock";
import { useI18n } from "../i18n/context";
import EpubReader from "../reader/EpubReader";
import PdfReader from "../reader/PdfReader";
import type { ReaderHandle, ReaderReadyInfo, SearchHit, TocItem } from "../reader/types";
import { percentOf, type TapZone } from "../lib/reading";
import { SEARCH_LIMIT } from "../lib/search";
import { readBookBytes } from "../lib/storage";
import { stepFontSize, stepZoom, type ZoomDirection } from "../lib/zoom";
import type { Book, Bookmark } from "../lib/types";
import type { LibraryActions } from "../state/useLibrary";

interface ReaderProps {
  book: Book;
  lib: LibraryActions;
  onBack: () => void;
}

type Panel = "drawer" | "search" | "bookmark" | "brightness" | "settings" | null;

interface SearchState {
  query: string;
  status: SearchStatus;
  progress: number;
  hits: SearchHit[];
  truncated: boolean;
}

const EMPTY_SEARCH: SearchState = { query: "", status: "idle", progress: 0, hits: [], truncated: false };

/** The shortest term worth scanning a whole book for. */
const MIN_QUERY_LENGTH = 2;

export default function Reader({ book, lib, onBack }: ReaderProps) {
  const { t } = useI18n();
  const handle = useRef<ReaderHandle | null>(null);
  const ready = useRef(false);
  const pendingSearch = useRef<string | null>(null);
  const searchRun = useRef<AbortController | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("contents");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);

  const { settings } = lib;
  const bookmarks = lib.state.data.bookmarks.filter((m) => m.bookId === book.id);
  const editing = bookmarks.find((m) => m.id === editingId) ?? null;
  const percent = percentOf(book.progress);
  const pdfPage = book.format === "pdf" ? Number(book.position ?? 1) || 1 : null;
  const currentBookmark = book.position ? bookmarks.find((m) => m.position === book.position) ?? null : null;
  // Brightness works as a veil: 100 shows the page as it is, 30 dims it the most.
  const veil = ((100 - settings.brightness) / 100) * 0.8;

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

  const closePanel = useCallback(() => setPanel(null), []);

  // Keyboard navigation for the reader. The EPUB frame reports its own keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (panel) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
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
  }, [panel, onBack]);

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

  const failed = loadFailed || openFailed;
  const positionLabel =
    book.format === "pdf" && totalPages > 0
      ? t("pageOf", { page: pdfPage ?? 1, total: totalPages })
      : `${percent} %`;

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
      id: "brightness",
      label: t("dockBrightness"),
      icon: <Sun size={20} aria-hidden="true" />,
      active: panel === "brightness",
      onSelect: () => setPanel(panel === "brightness" ? null : "brightness"),
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
    <div className={`reader${chromeVisible ? " reader--chrome" : ""}`}>
      <header className="reader__top">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t("back")}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="reader__title">{book.title}</h1>
      </header>

      <ToolDock label={t("dockLabel")} items={dockItems} />

      <main className="reader__stage">
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
          />
        ) : (
          <EpubReader
            ref={handle}
            bytes={bytes}
            initialPosition={book.position}
            flow={settings.flow}
            theme={settings.theme}
            fontSize={settings.fontSize}
            pageTurn={settings.pageTurn}
            onReady={handleReady}
            onPosition={handlePosition}
            onTap={handleTap}
            onError={() => setOpenFailed(true)}
            onZoomStep={handleZoomStep}
          />
        )}
        {failed ? null : <div className="reader__dim" style={{ opacity: veil }} aria-hidden="true" />}
      </main>

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

      {panel === "drawer" ? (
        <ReaderDrawer
          tab={drawerTab}
          onTabChange={setDrawerTab}
          toc={toc}
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
