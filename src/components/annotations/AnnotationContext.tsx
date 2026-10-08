import { createContext, useContext } from "react";
import type { InkStyle, Stroke } from "../../lib/annotations";
import type { AnnotationStore, ShownAnnotation } from "../../state/useAnnotations";

/** The marker as it is set in the tools right now. */
export interface InkTool {
  active: boolean;
  color: string;
  style: InkStyle;
  size: number;
}

/** Everything the page layers need: the book's notes and ink, the marker, and the actions. */
export interface AnnotationScene {
  annotations: ShownAnnotation[];
  strokes: Stroke[];
  ink: InkTool;
  store: AnnotationStore;
}

const AnnotationContext = createContext<AnnotationScene | null>(null);

export const AnnotationProvider = AnnotationContext.Provider;

export function useAnnotationScene(): AnnotationScene | null {
  return useContext(AnnotationContext);
}
