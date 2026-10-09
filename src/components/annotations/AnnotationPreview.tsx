import type { CSSProperties } from "react";
import { DEFAULT_NOTE_SIZE, type AnnotationDesign, type AnnotationKind, type Typography } from "../../lib/annotations";
import { useI18n } from "../../i18n/context";
import { annotationStyle } from "./annotationStyle";

interface AnnotationPreviewProps {
  kind: AnnotationKind;
  design: AnnotationDesign;
  color: string;
  typography: Typography;
}

/**
 * The look of a note or comment without its place on a page. The preview centers the item
 * itself, so the left, top and width that place it are left out.
 */
function lookOf(style: CSSProperties): CSSProperties {
  const { left: _left, top: _top, width: _width, ...look } = style;
  return look;
}

/**
 * Shows the design centered in its box: a comment as its open bubble, a note as the box it is
 * placed as, at the size a new note starts with. The box is drawn with its own width as the page
 * width, so the text, margin, line spacing and bubble or box grow and shrink together, and the
 * whole design stays inside the box.
 */
export default function AnnotationPreview({ kind, design, color, typography }: AnnotationPreviewProps) {
  const { t } = useI18n();
  const isNote = kind === "note";
  const sample = isNote ? t("previewSampleNote") : t("previewSampleComment");
  const look = lookOf(annotationStyle({ x: 0, y: 0, color, typography, size: isNote ? DEFAULT_NOTE_SIZE : undefined }));
  return (
    <div className="ann-preview" role="img" aria-label={t("sectionPreview")}>
      <div className="ann-preview__stage">
        <div className={`ann-preview__item ann-item ann-item--${kind} is-open`} style={look}>
          <div className={`ann-body ann-body--${design}${isNote ? " ann-body--free" : ""}`}>
            <div className="ann-bar" />
            <div className="ann-text">{sample}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
