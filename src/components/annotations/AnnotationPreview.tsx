import type { CSSProperties } from "react";
import { DEFAULT_NOTE_SIZE, type AnnotationDesign, type AnnotationKind, type Typography } from "../../lib/annotations";
import { useI18n } from "../../i18n/context";
import { annotationStyle } from "./annotationStyle";

/**
 * The preview is drawn at the scale of a page 600 px wide, so text, margins and the bubble or box
 * look as they will in a book. It is only a larger view: the size saved with the design is unchanged.
 */
const PREVIEW_REFERENCE = 600;

interface AnnotationPreviewProps {
  kind: AnnotationKind;
  design: AnnotationDesign;
  color: string;
  typography: Typography;
}

/**
 * Shows the design as it will look on a page: a comment as its dot and bubble, a note as the
 * box it is placed as, at the size a new note starts with.
 */
export default function AnnotationPreview({ kind, design, color, typography }: AnnotationPreviewProps) {
  const { t } = useI18n();
  const isNote = kind === "note";
  const sample = isNote ? t("previewSampleNote") : t("previewSampleComment");
  return (
    <div className="ann-preview" role="img" aria-label={t("sectionPreview")}>
      <div className="ann-preview__stage" style={{ "--page-w": `${PREVIEW_REFERENCE}px` } as CSSProperties}>
        {isNote ? null : (
          <div className="ann-item ann-item--comment" style={annotationStyle({ x: 0.08, y: 0.1, color, typography })}>
            <span className="ann-dot" />
          </div>
        )}
        <div
          className={`ann-item ann-item--${kind} is-open`}
          style={annotationStyle({
            x: 0.08,
            y: isNote ? 0.1 : 0.3,
            color,
            typography,
            size: isNote ? DEFAULT_NOTE_SIZE : undefined,
          })}
        >
          <div className={`ann-body ann-body--${design}${isNote ? " ann-body--free" : ""}`}>
            <div className="ann-bar" />
            <div className="ann-text">{sample}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
