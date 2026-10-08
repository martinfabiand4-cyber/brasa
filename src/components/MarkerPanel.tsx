import { ArrowCounterClockwise, Eraser, X } from "@phosphor-icons/react";
import { useId } from "react";
import { useI18n } from "../i18n/context";
import { curvePreviewPath, INK_COLORS, INK_STYLES, SIZE_LIMITS, type InkStyle } from "../lib/annotations";

export interface InkSettings {
  color: string;
  style: InkStyle;
  size: number;
}

interface MarkerPanelProps {
  ink: InkSettings;
  onChange: (patch: Partial<InkSettings>) => void;
  onUndo: () => void;
  onClearPage: () => void;
  onClose: () => void;
}

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 96;

/**
 * The marker's settings. While this panel is open, dragging on the page draws.
 * The curve below shows the thickness at the size the person has picked.
 */
export default function MarkerPanel({ ink, onChange, onUndo, onClearPage, onClose }: MarkerPanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [minSize, maxSize] = SIZE_LIMITS.ink;
  const styleKeys: Record<InkStyle, "inkStyleMarker" | "inkStylePen"> = { marker: "inkStyleMarker", pen: "inkStylePen" };

  return (
    <aside className="tool-sheet marker-sheet glass" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="tool-sheet__header">
        <h2 id={titleId}>{t("toolMarker")}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="tool-sheet__body">
        <p className="tool-sheet__hint">{t("inkHint")}</p>

        <section className="tool-sheet__section">
          <h3>{t("sectionColor")}</h3>
          <div className="swatches" role="radiogroup" aria-label={t("sectionColor")}>
            {INK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={ink.color === color}
                aria-label={color}
                className="swatch"
                style={{ background: color }}
                onClick={() => onChange({ color })}
              />
            ))}
          </div>
        </section>

        <section className="tool-sheet__section">
          <h3>{t("inkStyle")}</h3>
          <div className="font-chips" role="radiogroup" aria-label={t("inkStyle")}>
            {INK_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={ink.style === style}
                className="ink-chip"
                onClick={() => onChange({ style })}
              >
                {t(styleKeys[style])}
              </button>
            ))}
          </div>
        </section>

        <section className="tool-sheet__section">
          <h3>
            {t("inkThickness")} <output className="tool-sheet__value">{ink.size}</output>
          </h3>
          <input
            type="range"
            min={minSize}
            max={maxSize}
            step={1}
            value={ink.size}
            aria-label={t("inkThickness")}
            onChange={(event) => onChange({ size: Number(event.target.value) })}
          />
          <svg
            className="ink-preview"
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
            viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
            role="img"
            aria-label={`${t("inkThickness")}: ${ink.size}`}
          >
            <path
              d={curvePreviewPath(PREVIEW_WIDTH, PREVIEW_HEIGHT)}
              stroke={ink.color}
              strokeWidth={(ink.size * PREVIEW_WIDTH) / 600}
              className={`ann-ink__path ann-ink__path--${ink.style}`}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </section>
      </div>

      <footer className="tool-sheet__footer marker-sheet__actions">
        <button type="button" className="glass-button" onClick={onUndo}>
          <ArrowCounterClockwise size={16} aria-hidden="true" />
          {t("inkUndo")}
        </button>
        <button type="button" className="glass-button" onClick={onClearPage}>
          <Eraser size={16} aria-hidden="true" />
          {t("inkClear")}
        </button>
      </footer>
    </aside>
  );
}
