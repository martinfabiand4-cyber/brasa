import { X } from "@phosphor-icons/react";
import { useId, useState, type CSSProperties } from "react";
import { useI18n } from "../../i18n/context";
import type { DictionaryKey } from "../../i18n/dictionaries";
import {
  COMMENT_DESIGNS,
  DEFAULT_TYPOGRAPHY,
  FONT_FAMILIES,
  NOTE_DESIGNS,
  PAPER_COLORS,
  SIZE_LIMITS,
  TEXT_COLORS,
  type AnnotationDesign,
  type AnnotationKind,
  type FontFamily,
  type StyleTemplate,
  type Typography,
} from "../../lib/annotations";
import { createId } from "../../lib/format";
import AnnotationPreview from "./AnnotationPreview";
import { FONT_STACKS } from "./annotationStyle";

const DESIGN_KEYS: Record<AnnotationDesign, DictionaryKey> = {
  postit: "designPostit",
  paper: "designPaper",
  grid: "designGrid",
  bubble: "designBubble",
  box: "designBox",
};

const FONT_KEYS: Record<FontFamily, DictionaryKey> = {
  sans: "fontSans",
  serif: "fontSerif",
  mono: "fontMono",
  hand: "fontHand",
};

interface StyleDesignerProps {
  kind: AnnotationKind;
  /** Tools of this kind already saved, listed so they can be removed. */
  saved: StyleTemplate[];
  onSave: (template: StyleTemplate) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

/** The text fields the sliders adjust. Each one is shown with its own limits and step. */
const SLIDERS = [
  { key: "size", labelKey: "textSize", step: 1 },
  { key: "margin", labelKey: "textMargin", step: 1 },
  { key: "lineHeight", labelKey: "lineSpacing", step: 0.1 },
] as const;

/**
 * Designs a note or comment before it is used: its paper or bubble, colors and
 * typography, with a live preview. Saving keeps it as a dot in the tools.
 */
export default function StyleDesigner({ kind, saved, onSave, onRemove, onClose }: StyleDesignerProps) {
  const { t } = useI18n();
  const titleId = useId();
  const designs = kind === "note" ? NOTE_DESIGNS : COMMENT_DESIGNS;
  const [design, setDesign] = useState<AnnotationDesign>(designs[0]);
  const [color, setColor] = useState<string>(kind === "note" ? PAPER_COLORS[0] : PAPER_COLORS[6]);
  const [typography, setTypography] = useState<Typography>({ ...DEFAULT_TYPOGRAPHY, color: TEXT_COLORS[0] });

  function patchTypography(patch: Partial<Typography>) {
    setTypography((current) => ({ ...current, ...patch }));
  }

  function save() {
    onSave({ id: createId(), kind, design, color, typography });
  }

  const title = kind === "note" ? t("toolNote") : t("toolComment");
  const savedOfKind = saved.filter((item) => item.kind === kind);

  return (
    <aside className="tool-sheet design-sheet glass" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="tool-sheet__header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="tool-sheet__body">
        <section className="tool-sheet__section" aria-label={t("sectionDesign")}>
          <h3>{t("sectionDesign")}</h3>
          <div className="design-cards" role="radiogroup" aria-label={t("sectionDesign")}>
            {designs.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={design === item}
                className="design-card"
                onClick={() => setDesign(item)}
              >
                <span className={`design-card__sample ann-body--${item}`} style={{ "--ann-bg": color } as CSSProperties}>
                  <span />
                  <span />
                </span>
                <span className="design-card__name">{t(DESIGN_KEYS[item])}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="tool-sheet__section" aria-label={t("sectionColor")}>
          <h3>{t("sectionColor")}</h3>
          <Swatches colors={PAPER_COLORS} value={color} label={t("sectionColor")} onChange={setColor} />
        </section>

        <section className="tool-sheet__section" aria-label={t("sectionTypography")}>
          <h3>{t("sectionTypography")}</h3>
          <div className="font-chips" role="radiogroup" aria-label={t("sectionTypography")}>
            {FONT_FAMILIES.map((font) => (
              <button
                key={font}
                type="button"
                role="radio"
                aria-checked={typography.font === font}
                aria-label={t(FONT_KEYS[font])}
                title={t(FONT_KEYS[font])}
                className="font-chip"
                style={{ fontFamily: FONT_STACKS[font] }}
                onClick={() => patchTypography({ font })}
              >
                Aa
              </button>
            ))}
          </div>

          <p className="tool-sheet__label">{t("textColor")}</p>
          <Swatches
            colors={TEXT_COLORS}
            value={typography.color}
            label={t("textColor")}
            onChange={(next) => patchTypography({ color: next })}
            small
          />

          {SLIDERS.map((slider) => {
            const [min, max] = SIZE_LIMITS[slider.key];
            const value = typography[slider.key];
            return (
              <label key={slider.key} className="slider-row">
                <span>{t(slider.labelKey)}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={slider.step}
                  value={value}
                  onChange={(event) => patchTypography({ [slider.key]: Number(event.target.value) } as Partial<Typography>)}
                />
                <output>{slider.key === "lineHeight" ? value.toFixed(1) : value}</output>
              </label>
            );
          })}
        </section>

        <section className="tool-sheet__section" aria-label={t("sectionPreview")}>
          <h3>{t("sectionPreview")}</h3>
          <AnnotationPreview kind={kind} design={design} color={color} typography={typography} />
        </section>

        {savedOfKind.length > 0 ? (
          <section className="tool-sheet__section" aria-label={t("savedTools")}>
            <h3>{t("savedTools")}</h3>
            <ul className="saved-list">
              {savedOfKind.map((item) => (
                <li key={item.id}>
                  <span className="saved-list__dot" style={{ background: item.color }} aria-hidden="true" />
                  <span className="saved-list__name">{t(DESIGN_KEYS[item.design])}</span>
                  <button type="button" className="icon-button" onClick={() => onRemove(item.id)} aria-label={t("removeTool")}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="tool-sheet__footer">
        <button type="button" className="glass-button glass-button--primary" onClick={save}>
          {t("saveTool")}
        </button>
      </footer>
    </aside>
  );
}

function Swatches({
  colors,
  value,
  label,
  onChange,
  small,
}: {
  colors: readonly string[];
  value: string;
  label: string;
  onChange: (color: string) => void;
  small?: boolean;
}) {
  return (
    <div className={`swatches${small ? " swatches--small" : ""}`} role="radiogroup" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className="swatch"
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
