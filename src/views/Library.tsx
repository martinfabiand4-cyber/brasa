import { ArrowsDownUp, FolderOpen, GearSix, Plus, X } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import BookCard from "../components/BookCard";
import ConfirmDialog from "../components/ConfirmDialog";
import SettingsPanel from "../components/SettingsPanel";
import { useI18n, type Translate } from "../i18n/context";
import { backfillCovers } from "../lib/coverBackfill";
import { ImportError } from "../lib/importer";
import { sortBooks } from "../lib/sort";
import type { Book, SortMode } from "../lib/types";
import type { LibraryActions } from "../state/useLibrary";

interface LibraryProps {
  lib: LibraryActions;
  onOpen: (bookId: string) => void;
}

const SORT_MODES: SortMode[] = ["alphabetical", "recentlyOpened", "recentlyAdded"];
const EXTENSIONS = ["epub", "pdf"];

export default function Library({ lib, onOpen }: LibraryProps) {
  const { t, locale } = useI18n();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Book | null>(null);

  const { books } = lib.state.data;
  const sortKey = lib.settings.sort;
  const { updateBook } = lib;
  const coversStarted = useRef(false);

  // Once the library is loaded, books from before covers existed get theirs in the background.
  useEffect(() => {
    if (lib.state.status !== "ready" || coversStarted.current) return;
    coversStarted.current = true;
    void backfillCovers(lib.state.data.books, (bookId, coverPath) => updateBook(bookId, { coverPath }));
  }, [lib.state.status, lib.state.data.books, updateBook]);

  const visible = useMemo(() => {
    const sorted = sortBooks(books, sortKey, locale);
    return favoritesOnly ? sorted.filter((b) => b.favorite) : sorted;
  }, [books, sortKey, favoritesOnly, locale]);

  // Files dropped onto the window are imported exactly like the file picker does.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === "enter" || event.payload.type === "over") setDragging(true);
          if (event.payload.type === "leave") setDragging(false);
          if (event.payload.type === "drop") {
            setDragging(false);
            void lib.importPaths(event.payload.paths);
          }
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => undefined);
    } catch {
      // Running outside the desktop shell, for example in a plain browser preview.
    }
    return () => unlisten?.();
  }, [lib.importPaths]);

  async function handlePick() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "EPUB, PDF", extensions: EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setBusy(true);
    try {
      await lib.importPaths(paths);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    const book = pendingRemove;
    setPendingRemove(null);
    await lib.removeBook(book);
  }

  const { issues } = lib.state;
  const empty = books.length === 0;

  return (
    <div className={`library${dragging ? " library--dragging" : ""}`}>
      <header className="library__header">
        <div className="wordmark" aria-label={t("appName")}>
          <span className="wordmark__ember" aria-hidden="true" />
          <span>{t("appName")}</span>
        </div>

        <div className="library__toolbar">
          <div className="segmented" role="group" aria-label={t("filterAll")}>
            <button
              type="button"
              aria-pressed={!favoritesOnly}
              onClick={() => setFavoritesOnly(false)}
            >
              {t("filterAll")}
            </button>
            <button
              type="button"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(true)}
            >
              {t("filterFavorites")}
            </button>
          </div>

          <div className="segmented" role="group" aria-label={t("sortLabel")}>
            <ArrowsDownUp size={16} aria-hidden="true" className="segmented__icon" />
            {SORT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={sortKey === mode}
                onClick={() => lib.updateSettings({ sort: mode })}
              >
                {mode === "alphabetical"
                  ? t("sortAlphabetical")
                  : mode === "recentlyOpened"
                    ? t("sortRecentlyOpened")
                    : t("sortRecentlyAdded")}
              </button>
            ))}
          </div>

          <button type="button" className="icon-button" onClick={() => setSettingsOpen(true)} aria-label={t("settings")}>
            <GearSix size={20} aria-hidden="true" />
          </button>
          {/* One import action per screen: the empty state carries its own button. */}
          {empty ? null : (
            <button type="button" className="button button--primary" onClick={handlePick} disabled={busy}>
              <Plus size={16} weight="bold" aria-hidden="true" />
              {busy ? t("importing") : t("importBooks")}
            </button>
          )}
        </div>
      </header>

      {lib.state.recovered ? <Notice tone="warning" onDismiss={lib.clearIssues}>{t("libraryRecovered")}</Notice> : null}

      {issues.length > 0 ? (
        <div className="notices">
          {issues.map((issue, index) => (
            <Notice key={`${issue.fileName}-${index}`} tone="error" onDismiss={lib.clearIssues}>
              {issueMessage(issue, t)}
            </Notice>
          ))}
        </div>
      ) : null}

      {empty ? (
        <section className="empty" aria-labelledby="empty-title">
          <FolderOpen size={56} weight="thin" aria-hidden="true" className="empty__icon" />
          <h1 id="empty-title">{t("emptyTitle")}</h1>
          <p>{t("emptyBody")}</p>
          <button type="button" className="button button--primary" onClick={handlePick}>
            <Plus size={16} weight="bold" aria-hidden="true" />
            {t("importBooks")}
          </button>
        </section>
      ) : (
        <ul className="shelf" aria-label={t("library")}>
          {visible.map((book) => (
            <li key={book.id}>
              <BookCard
                book={book}
                onOpen={() => onOpen(book.id)}
                onToggleFavorite={() => lib.updateBook(book.id, { favorite: !book.favorite })}
                onRemove={() => setPendingRemove(book)}
              />
            </li>
          ))}
        </ul>
      )}

      {dragging ? (
        <div className="drop-hint" aria-hidden="true">
          <FolderOpen size={40} weight="thin" />
          <span>{t("importBooks")}</span>
        </div>
      ) : null}

      {pendingRemove ? (
        <ConfirmDialog
          title={t("confirmRemoveTitle")}
          body={t("confirmRemoveBody")}
          confirmLabel={t("remove")}
          cancelLabel={t("cancel")}
          danger
          onConfirm={() => void confirmRemove()}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel lib={lib} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  );
}

function issueMessage(issue: ImportError, t: Translate): string {
  switch (issue.reason) {
    case "unsupported":
      return `${issue.fileName}: ${t("unsupportedFormat")}`;
    case "duplicate":
      return t("alreadyInLibrary", { name: issue.fileName });
    case "unreadable":
      return t("importFailed", { name: issue.fileName });
  }
}

function Notice({
  tone,
  onDismiss,
  children,
}: {
  tone: "warning" | "error";
  onDismiss: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className={`notice notice--${tone}`} role="status">
      <span>{children}</span>
      <button type="button" className="icon-button" onClick={onDismiss} aria-label={t("close")}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
