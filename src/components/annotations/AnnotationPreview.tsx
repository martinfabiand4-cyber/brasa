import type { CSSProperties } from "react";
import { type AnnotationDesign, type AnnotationKind, type Typography } from "../../lib/annotations";
import { useI18n } from "../../i18n/context";
import { annotationStyle } from "./annotationStyle";

/** The width the preview draws at, in reference units; it is scaled down to fit the sheet. */
const PREVIEW_REFERENCE = 600;

interface AnnotationPreviewProps {
  kind: AnnotationKind;
  design: AnnotationDesign;
  color: string;
  typography: Typography;
}

/**
 * Shows the closed dot and the open note or comment exactly as they will look on
 * a page, so the person sees every change while they make it.
 */
export default function AnnotationPreview({ kind, design, color, typography }: AnnotationPreviewProps) {
  const { t } = useI18n();
  const sample = kind === "note" ? t("previewSampleNote") : t("previewSampleComment");
  return (
    <div className="ann-preview" role="img" aria-label={t("sectionPreview")}>
      <div className="ann-preview__stage" style={{ "--page-w": `${PREVIEW_REFERENCE}px` } as CSSProperties}>
        <div className={`ann-item ann-item--${kind}`} style={annotationStyle({ x: 0.08, y: 0.1, color, typography })}>
          <span className="ann-dot" />
        </div>
        <div className={`ann-item ann-item--${kind} is-open`} style={annotationStyle({ x: 0.08, y: 0.3, color, typography })}>
          <div className={`ann-body ann-body--${design}`}>
            <div className="ann-bar" />
            <div className="ann-text">{sample}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
