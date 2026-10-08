import { BookmarkSimple, Trash, X } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { useI18n } from "../i18n/context";
import type { TocItem } from "../reader/types";
import type { Bookmark } from "../lib/types";

export type DrawerTab = "contents" | "bookmarks";

interface ReaderDrawerProps {
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  toc: TocItem[];
  bookmarks: Bookmark[];
  onGo: (target: string) => void;
  onRemoveBookmark: (id: string) => void;
  bookmarkLabel: (bookmark: Bookmark) => string;
  onClose: () => void;
}

export default function ReaderDrawer({
  tab,
  onTabChange,
  toc,
  bookmarks,
  onGo,
  onRemoveBookmark,
  bookmarkLabel,
  onClose,
}: ReaderDrawerProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim scrim--side" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`drawer${ready ? " drawer--open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer__header">
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "contents"} aria-pressed={tab === "contents"} onClick={() => onTabChange("contents")}>
              {t("contents")}
            </button>
            <button type="button" role="tab" aria-selected={tab === "bookmarks"} aria-pressed={tab === "bookmarks"} onClick={() => onTabChange("bookmarks")}>
              {t("bookmarks")}
            </button>
          </div>
          <h2 id={titleId} className="visually-hidden">
            {tab === "contents" ? t("contents") : t("bookmarks")}
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {tab === "contents" ? (
          toc.length === 0 ? (
            <p className="drawer__empty">{t("noContents")}</p>
          ) : (
            <ol className="toc">
              {toc.map((item, index) => (
                <li key={`${item.label}-${index}`} style={{ paddingLeft: `${item.depth * 16}px` }}>
                  <button
                    type="button"
                    disabled={item.target === null}
                    onClick={() => item.target !== null && onGo(item.target)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
          )
        ) : bookmarks.length === 0 ? (
          <p className="drawer__empty">{t("noBookmarks")}</p>
        ) : (
          <ul className="bookmarks">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <button type="button" className="bookmarks__go" onClick={() => onGo(bookmark.position)}>
                  <BookmarkSimple size={16} aria-hidden="true" />
                  <span>{bookmarkLabel(bookmark)}</span>
                </button>
                <button type="button" className="icon-button" onClick={() => onRemoveBookmark(bookmark.id)} aria-label={t("removeBookmark")}>
                  <Trash size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
