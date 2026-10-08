import { Trash, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useI18n } from "../i18n/context";
import { BOOKMARK_COLORS, BOOKMARK_DESIGNS, DEFAULT_BOOKMARK_COLOR, DEFAULT_BOOKMARK_DESIGN } from "../lib/bookmarks";
import type { Bookmark, BookmarkDesign } from "../lib/types";
import BookmarkIcon from "./BookmarkIcon";

export interface BookmarkValues {
  label: string;
  design: BookmarkDesign;
  color: string;
}

interface BookmarkSheetProps {
  /** The bookmark being edited, or null to save the current page as a new one. */
  initial: Bookmark | null;
  defaultName: string;
  onSave: (values: BookmarkValues) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function BookmarkSheet({ initial, defaultName, onSave, onRemove, onClose }: BookmarkSheetProps) {
  const { t } = useI18n();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(initial?.label || defaultName);
  const [design, setDesign] = useState<BookmarkDesign>(initial?.design ?? DEFAULT_BOOKMARK_DESIGN);
  const [color, setColor] = useState(initial?.color ?? DEFAULT_BOOKMARK_COLOR);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const designNames: Record<BookmarkDesign, string> = {
    ribbon: t("designRibbon"),
    tag: t("designTag"),
    flag: t("designFlag"),
    dot: t("designDot"),
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ label: label.trim() || defaultName, design, color });
  }

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="sheet bookmark-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <header className="sheet__header">
          <h2 id={titleId}>{t("bookmarkTitle")}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="bookmark-sheet__preview">
          <BookmarkIcon design={design} color={color} size={44} />
          <span>{label.trim() || defaultName}</span>
        </div>

        <label className="field">
          <span className="field__label">
            <span>{t("bookmarkName")}</span>
          </span>
          <input
            ref={inputRef}
            className="bookmark-sheet__input"
            type="text"
            maxLength={60}
            value={label}
            placeholder={defaultName}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>

        <section className="field">
          <div className="field__label">
            <span>{t("bookmarkDesign")}</span>
          </div>
          <div className="design-grid" role="radiogroup" aria-label={t("bookmarkDesign")}>
            {BOOKMARK_DESIGNS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={design === option}
                className="design-option"
                onClick={() => setDesign(option)}
              >
                <BookmarkIcon design={option} color={color} size={28} />
                <span>{designNames[option]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="field">
          <div className="field__label">
            <span>{t("bookmarkColor")}</span>
          </div>
          <div className="swatches" role="radiogroup" aria-label={t("bookmarkColor")}>
            {BOOKMARK_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={color === option}
                aria-label={option}
                className="swatch"
                style={{ "--swatch": option } as CSSProperties}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </section>

        <footer className="sheet__actions">
          {initial ? (
            <button type="button" className="button button--quiet-danger" onClick={onRemove}>
              <Trash size={16} aria-hidden="true" />
              {t("bookmarkDelete")}
            </button>
          ) : (
            <span />
          )}
          <div className="sheet__actions-end">
            <button type="button" className="button" onClick={onClose}>
              {t("cancel")}
            </button>
            <button type="submit" className="button button--primary">
              {initial ? t("bookmarkUpdate") : t("bookmarkSave")}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
