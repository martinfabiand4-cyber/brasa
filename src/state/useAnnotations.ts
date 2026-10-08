import { useCallback, useMemo, useRef, useState } from "react";
import { createId } from "../lib/format";
import {
  normalizeAnnotationFile,
  type Annotation,
  type AnnotationFile,
  type AnnotationKind,
  type AnnotationDesign,
  type Stroke,
  type InkStyle,
  type Typography,
} from "../lib/annotations";
import { NOTES_DIR } from "../lib/storage";
import { useSidecar } from "./useSidecar";

/** What a new note or comment needs before it is placed on a page. */
export interface NewAnnotation {
  kind: AnnotationKind;
  design: AnnotationDesign;
  color: string;
  typography: Typography;
  anchor: string;
  x: number;
  y: number;
}

export interface NewStroke {
  anchor: string;
  color: string;
  style: InkStyle;
  size: number;
  points: number[];
}

/** An annotation as the reader shows it: the saved fields plus whether its bubble is open. */
export type ShownAnnotation = Annotation & { open: boolean };

/**
 * Notes, comments and ink for one book. Which bubble is open is only kept on screen,
 * so reopening a book always shows every note as a dot.
 */
export function useAnnotations(bookId: string) {
  const { value, update } = useSidecar<AnnotationFile>(`${NOTES_DIR}/${bookId}.json`, normalizeAnnotationFile);
  const [openId, setOpenId] = useState<string | null>(null);
  const openRef = useRef<string | null>(null);

  const annotations = useMemo<ShownAnnotation[]>(
    () => (value?.annotations ?? []).map((item) => ({ ...item, open: item.id === openId })),
    [value, openId],
  );
  const strokes = useMemo<Stroke[]>(() => value?.strokes ?? [], [value]);

  const setOpen = useCallback((id: string, open: boolean) => {
    // Only one bubble is open at a time, so a click elsewhere always leaves a clear state.
    const next = open ? id : null;
    openRef.current = next;
    setOpenId(next);
  }, []);

  const collapseAll = useCallback(() => {
    openRef.current = null;
    setOpenId(null);
  }, []);

  const hasOpen = useCallback(() => openRef.current !== null, []);

  const add = useCallback(
    (input: NewAnnotation): string => {
      const id = createId();
      const item: Annotation = { ...input, id, text: "", createdAt: Date.now() };
      update((file) => ({ ...file, annotations: [...file.annotations, item] }));
      setOpen(id, true);
      return id;
    },
    [update, setOpen],
  );

  const move = useCallback(
    (id: string, x: number, y: number) => {
      update((file) => ({
        ...file,
        annotations: file.annotations.map((item) => (item.id === id ? { ...item, x, y } : item)),
      }));
    },
    [update],
  );

  const edit = useCallback(
    (id: string, text: string) => {
      update((file) => ({
        ...file,
        annotations: file.annotations.map((item) => (item.id === id ? { ...item, text } : item)),
      }));
    },
    [update],
  );

  const remove = useCallback(
    (id: string) => {
      if (openRef.current === id) collapseAll();
      update((file) => ({ ...file, annotations: file.annotations.filter((item) => item.id !== id) }));
    },
    [update, collapseAll],
  );

  const addStroke = useCallback(
    (input: NewStroke) => {
      const stroke: Stroke = { ...input, id: createId() };
      update((file) => ({ ...file, strokes: [...file.strokes, stroke] }));
    },
    [update],
  );

  /** Removes the most recent stroke, wherever it was drawn. */
  const undoStroke = useCallback(() => {
    update((file) => ({ ...file, strokes: file.strokes.slice(0, -1) }));
  }, [update]);

  const clearStrokes = useCallback(
    (anchor: string) => {
      update((file) => ({ ...file, strokes: file.strokes.filter((stroke) => stroke.anchor !== anchor) }));
    },
    [update],
  );

  return {
    ready: value !== null,
    annotations,
    strokes,
    hasOpen,
    setOpen,
    collapseAll,
    add,
    move,
    edit,
    remove,
    addStroke,
    undoStroke,
    clearStrokes,
  };
}

export type AnnotationStore = ReturnType<typeof useAnnotations>;
