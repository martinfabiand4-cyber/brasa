import { BookmarkSimple, Star, Trash } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { useI18n } from "../i18n/context";
import { percentOf } from "../lib/reading";
import type { Book } from "../lib/types";
import { useCover } from "../lib/useCover";

interface BookCardProps {
  book: Book;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
}

/**
 * A book's own cover when it has one. Otherwise a generated cover in the crimson
 * family, drawn from the title so every book keeps a stable, recognizable face.
 */
function coverHue(hue: number): number {
  return 348 + (hue % 36);
}

export default function BookCard({ book, onOpen, onToggleFavorite, onRemove }: BookCardProps) {
  const { t } = useI18n();
  const percent = percentOf(book.progress);
  const image = useCover(book.coverPath);
  const coverStyle = {
    "--cover-hue": coverHue(book.hue),
  } as CSSProperties;

  return (
    <article className="book-card">
      <button
        type="button"
        className={`book-card__cover${image ? " book-card__cover--image" : ""}`}
        style={coverStyle}
        onClick={onOpen}
        aria-label={book.title}
      >
        {image ? (
          <img className="book-card__image" src={image} alt="" />
        ) : (
          <span className="book-card__title-on-cover">{book.title}</span>
        )}
        <span className="book-card__format">{book.format.toUpperCase()}</span>
        {book.favorite ? <Star className="book-card__star" weight="fill" aria-hidden="true" /> : null}
      </button>

      <div className="book-card__meta">
        <button type="button" className="book-card__title" onClick={onOpen}>
          {book.title}
        </button>
        {book.author ? <p className="book-card__author">{book.author}</p> : null}

        <div className="book-card__progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("progressLabel", { percent })}>
          <span style={{ transform: `scaleX(${percent / 100})` }} />
        </div>

        <div className="book-card__actions">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleFavorite}
            aria-pressed={book.favorite}
            aria-label={book.favorite ? t("removeFavorite") : t("addFavorite")}
          >
            <Star size={18} weight={book.favorite ? "fill" : "regular"} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" onClick={onRemove} aria-label={t("removeBook")}>
            <Trash size={18} aria-hidden="true" />
          </button>
          {book.position ? (
            <span className="book-card__resume" title={t("resumeReading")}>
              <BookmarkSimple size={18} aria-hidden="true" />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
