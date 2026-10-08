import { ArrowLeft, BookmarkSimple, GearSix, ListBullets } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import ReaderDrawer, { type DrawerTab } from "../components/ReaderDrawer";
import SettingsPanel from "../components/SettingsPanel";
import EpubReader from "../reader/EpubReader";
import PdfReader from "../reader/PdfReader";
import type { ReaderHandle, ReaderReadyInfo, TocItem } from "../reader/types";
import { useI18n } from "../i18n/context";
import { percentOf, type TapZone } from "../lib/reading";
import { readBookBytes } from "../lib/storage";
import type { Book, Bookmark } from "../lib/types";
import type { LibraryActions } from "../state/useLibrary";

interface ReaderProps {
  book: Book;
  lib: LibraryActions;
  onBack: () => void;
}

type Panel = "drawer" | "settings" | null;

export default function Reader({ book, lib, onBack }: ReaderProps) {
  const { t } = useI18n();
  const handle = useRef<ReaderHandle | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("contents");

  const { settings } = lib;
  const bookmarks = lib.state.data.bookmarks.filter((m) => m.bookId === book.id);
  const percent = percentOf(book.progress);
  const pdfPage = book.format === "pdf" ? Number(book.position ?? 1) || 1 : null;
  const currentBookmark = book.position
    ? bookmarks.find((m) => m.position === book.position) ?? null
    : null;

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

  function handleTap(zone: TapZone) {
    if (zone === "previous") handle.current?.previous();
    else if (zone === "next") handle.current?.next();
    else setChromeVisible((visible) => !visible);
  }

  function handleReady(info: ReaderReadyInfo) {
    setToc(info.toc);
    setTotalPages(info.totalPages);
  }

  function handlePosition(position: string, progress: number) {
    lib.updateBook(book.id, { position, progress });
  }

  function toggleBookmark() {
    if (currentBookmark) {
      lib.removeBookmark(currentBookmark.id);
      return;
    }
    if (!book.position) return;
    const label = book.format === "pdf" ? "" : t("noBookmarkedPage", { position: `${percent} %` });
    lib.addBookmark(book.id, book.position, label);
  }

  function bookmarkLabel(bookmark: Bookmark): string {
    if (book.format === "pdf") {
      return t("pageOf", { page: bookmark.position, total: totalPages || "?" });
    }
    return bookmark.label || t("noBookmarkedPage", { position: "…" });
  }

  function openDrawer(tab: DrawerTab) {
    setDrawerTab(tab);
    setPanel("drawer");
  }

  const failed = loadFailed || openFailed;
  const positionLabel =
    book.format === "pdf" && totalPages > 0
      ? t("pageOf", { page: pdfPage ?? 1, total: totalPages })
      : `${percent} %`;

  return (
    <div className={`reader${chromeVisible ? " reader--chrome" : ""}`}>
      <header className="reader__top">
        <button type="button" className="icon-button" onClick={onBack} aria-label={t("back")}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="reader__title">{book.title}</h1>
        <div className="reader__actions">
          <button type="button" className="icon-button" onClick={() => openDrawer("contents")} aria-label={t("contents")}>
            <ListBullets size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={toggleBookmark}
            aria-pressed={currentBookmark !== null}
            aria-label={currentBookmark ? t("removeBookmark") : t("addBookmark")}
          >
            <BookmarkSimple size={20} weight={currentBookmark ? "fill" : "regular"} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("settings")} aria-label={t("settings")}>
            <GearSix size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

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
          />
        )}
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
          <span style={{ width: `${percent}%` }} />
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
            setPanel(null);
          }}
          onRemoveBookmark={(id) => lib.removeBookmark(id)}
          bookmarkLabel={bookmarkLabel}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel === "settings" ? <SettingsPanel lib={lib} onClose={() => setPanel(null)} /> : null}
    </div>
  );
}
