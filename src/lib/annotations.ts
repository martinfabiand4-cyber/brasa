import { createId } from "./format";

/**
 * Notes and comments the person places on a book, and the ink they draw with the
 * marker. Everything here is plain data and pure functions, so the reader and
 * the tests share one definition.
 */

export type AnnotationKind = "note" | "comment";
export type NoteDesign = "postit" | "paper" | "grid";
export type CommentDesign = "bubble" | "box";
export type AnnotationDesign = NoteDesign | CommentDesign;
export type FontFamily = "sans" | "serif" | "mono" | "hand";
export type InkStyle = "marker" | "pen";

/**
 * Sizes inside annotations and ink are stored against a page this wide, then
 * scaled to the page on screen. Zooming the page therefore zooms them too.
 */
export const REFERENCE_WIDTH = 600;

export const NOTE_DESIGNS: readonly NoteDesign[] = ["postit", "paper", "grid"];
export const COMMENT_DESIGNS: readonly CommentDesign[] = ["bubble", "box"];
export const FONT_FAMILIES: readonly FontFamily[] = ["sans", "serif", "mono", "hand"];
export const INK_STYLES: readonly InkStyle[] = ["marker", "pen"];

/** Background colors for notes and comments. */
export const PAPER_COLORS: readonly string[] = [
  "#ffe66d",
  "#ffb3c7",
  "#b8f0d0",
  "#afcbff",
  "#ffd2a3",
  "#d9c4ff",
  "#ffffff",
  "#2b2d33",
];

/** Text colors for notes and comments. */
export const TEXT_COLORS: readonly string[] = ["#1c1f24", "#ffffff", "#b3122e", "#1f5fbf", "#2e7d4f", "#7a4b12"];

/** Colors for the marker. */
export const INK_COLORS: readonly string[] = ["#ffe030", "#ff6b9a", "#4fd1a5", "#4da3ff", "#ff9f45", "#b57bff", "#1c1f24"];

export const SIZE_LIMITS = {
  size: [6, 36],
  margin: [0, 24],
  lineHeight: [1, 2.4],
  ink: [1, 40],
  /** Notes are free rectangles: their width and height are chosen by the person, within these limits. */
  noteWidth: [80, 720],
  noteHeight: [48, 900],
} as const;

/** The size a note has when it is first placed, in reference units. It can be resized on the page. */
export const DEFAULT_NOTE_SIZE = { width: 220, height: 160 } as const;

export interface Typography {
  font: FontFamily;
  color: string;
  /** Text size against the reference page width. */
  size: number;
  /** Space between the text and the edge of its box, against the reference width. */
  margin: number;
  /** Line spacing as a multiple of the text size. */
  lineHeight: number;
}

/** A saved kind of note or comment, shown as a dot in the tools until it is placed. */
export interface StyleTemplate {
  id: string;
  kind: AnnotationKind;
  design: AnnotationDesign;
  color: string;
  typography: Typography;
}

/** One note or comment placed on a page or on the current EPUB page. */
export interface Annotation {
  id: string;
  kind: AnnotationKind;
  design: AnnotationDesign;
  color: string;
  typography: Typography;
  /** The page it sits on: a page number for PDF, the page's start CFI for EPUB. */
  anchor: string;
  /** Position from 0 to 1 of the page's width and height: the dot for a comment, the top-left corner for a note. */
  x: number;
  y: number;
  /** Notes only: the size of the box, in reference units. */
  width?: number;
  height?: number;
  text: string;
  createdAt: number;
}

/** One stroke of ink. Points are flat pairs (x, y) from 0 to 1 of the page. */
export interface Stroke {
  id: string;
  anchor: string;
  color: string;
  style: InkStyle;
  size: number;
  points: number[];
}

export interface AnnotationFile {
  version: 1;
  annotations: Annotation[];
  strokes: Stroke[];
}

export const DEFAULT_TYPOGRAPHY: Typography = {
  font: "sans",
  color: "#1c1f24",
  size: 18,
  margin: 10,
  lineHeight: 1.4,
};

export const DEFAULT_INK = { color: INK_COLORS[0], style: "marker" as InkStyle, size: 14 };

export function designsFor(kind: AnnotationKind): readonly AnnotationDesign[] {
  return kind === "note" ? NOTE_DESIGNS : COMMENT_DESIGNS;
}

export function defaultDesign(kind: AnnotationKind): AnnotationDesign {
  return kind === "note" ? "postit" : "bubble";
}

/** Keeps a number inside its limits, using the fallback when the value is not a number. */
function within(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function unit(value: unknown, fallback: number): number {
  return within(value, [0, 1], fallback);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function normalizeTypography(raw: unknown): Typography {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Record<keyof Typography, unknown>>;
  return {
    font: pick(input.font, FONT_FAMILIES, DEFAULT_TYPOGRAPHY.font),
    color: isHexColor(input.color) ? input.color : DEFAULT_TYPOGRAPHY.color,
    size: within(input.size, SIZE_LIMITS.size, DEFAULT_TYPOGRAPHY.size),
    margin: within(input.margin, SIZE_LIMITS.margin, DEFAULT_TYPOGRAPHY.margin),
    lineHeight: within(input.lineHeight, SIZE_LIMITS.lineHeight, DEFAULT_TYPOGRAPHY.lineHeight),
  };
}

/** A design only counts for the kind it belongs to; anything else falls back to that kind's first design. */
function designFor(kind: AnnotationKind, value: unknown): AnnotationDesign {
  const allowed = designsFor(kind) as readonly AnnotationDesign[];
  return allowed.includes(value as AnnotationDesign) ? (value as AnnotationDesign) : defaultDesign(kind);
}

export function normalizeTemplate(raw: unknown): StyleTemplate | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Partial<Record<keyof StyleTemplate, unknown>>;
  if (input.kind !== "note" && input.kind !== "comment") return null;
  return {
    id: typeof input.id === "string" && input.id ? input.id : createId(),
    kind: input.kind,
    design: designFor(input.kind, input.design),
    color: isHexColor(input.color) ? input.color : PAPER_COLORS[0],
    typography: normalizeTypography(input.typography),
  };
}

export function normalizeAnnotation(raw: unknown): Annotation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Partial<Record<keyof Annotation, unknown>>;
  if (input.kind !== "note" && input.kind !== "comment") return null;
  if (typeof input.anchor !== "string" || input.anchor === "") return null;
  const annotation: Annotation = {
    id: typeof input.id === "string" && input.id ? input.id : createId(),
    kind: input.kind,
    design: designFor(input.kind, input.design),
    color: isHexColor(input.color) ? input.color : PAPER_COLORS[0],
    typography: normalizeTypography(input.typography),
    anchor: input.anchor,
    x: unit(input.x, 0.5),
    y: unit(input.y, 0.5),
    text: typeof input.text === "string" ? input.text : "",
    createdAt: typeof input.createdAt === "number" ? input.createdAt : 0,
  };
  if (annotation.kind === "note") {
    annotation.width = within(input.width, SIZE_LIMITS.noteWidth, DEFAULT_NOTE_SIZE.width);
    annotation.height = within(input.height, SIZE_LIMITS.noteHeight, DEFAULT_NOTE_SIZE.height);
  }
  return annotation;
}

export function normalizeStroke(raw: unknown): Stroke | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Partial<Record<keyof Stroke, unknown>>;
  if (typeof input.anchor !== "string" || input.anchor === "") return null;
  if (!Array.isArray(input.points) || input.points.length < 2) return null;
  // Points come in pairs; a stray value at the end is dropped rather than rejecting the stroke.
  const points = input.points.slice(0, input.points.length - (input.points.length % 2)).map((value) => unit(value, 0));
  return {
    id: typeof input.id === "string" && input.id ? input.id : createId(),
    anchor: input.anchor,
    color: isHexColor(input.color) ? input.color : INK_COLORS[0],
    style: pick(input.style, INK_STYLES, "marker"),
    size: within(input.size, SIZE_LIMITS.ink, DEFAULT_INK.size),
    points,
  };
}

export function normalizeAnnotationFile(raw: unknown): AnnotationFile {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<AnnotationFile>;
  return {
    version: 1,
    annotations: Array.isArray(input.annotations)
      ? input.annotations.map(normalizeAnnotation).filter((item): item is Annotation => item !== null)
      : [],
    strokes: Array.isArray(input.strokes)
      ? input.strokes.map(normalizeStroke).filter((item): item is Stroke => item !== null)
      : [],
  };
}

/** Position inside a box, from 0 to 1 on each axis, for a pointer position in client pixels. */
export function positionIn(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  const width = rect.width || 1;
  const height = rect.height || 1;
  return {
    x: unit((clientX - rect.left) / width, 0),
    y: unit((clientY - rect.top) / height, 0),
  };
}

/** A value in reference units, converted to pixels for a page of the given width. */
export function scaledPx(value: number, pageWidth: number): number {
  return (value * pageWidth) / REFERENCE_WIDTH;
}

/** Adds a point to a stroke only when the pen has moved far enough, so long strokes stay light. */
export function shouldAddPoint(points: number[], x: number, y: number, minDistance = 0.002): boolean {
  if (points.length < 2) return true;
  const dx = x - points[points.length - 2];
  const dy = y - points[points.length - 1];
  return Math.hypot(dx, dy) >= minDistance;
}

/**
 * An SVG path through the points that curves smoothly between them, the way a
 * drawing app draws a freehand line. Coordinates are scaled to the page size.
 */
export function inkPath(points: number[], width: number, height: number): string {
  const count = Math.floor(points.length / 2);
  if (count === 0) return "";
  const px = (i: number) => points[i * 2] * width;
  const py = (i: number) => points[i * 2 + 1] * height;
  if (count === 1) return `M${px(0)} ${py(0)} l0.01 0`;

  let d = `M${px(0)} ${py(0)}`;
  for (let i = 1; i < count - 1; i += 1) {
    const midX = (px(i) + px(i + 1)) / 2;
    const midY = (py(i) + py(i + 1)) / 2;
    d += ` Q${px(i)} ${py(i)} ${midX} ${midY}`;
  }
  d += ` L${px(count - 1)} ${py(count - 1)}`;
  return d;
}

/** The curve the marker preview draws: an S that shows how the thickness looks in a stroke. */
export function curvePreviewPath(width: number, height: number): string {
  const pad = height * 0.25;
  return `M${pad} ${height * 0.72} C${width * 0.3} ${height * 0.02}, ${width * 0.52} ${height * 0.98}, ${width - pad} ${height * 0.28}`;
}

export function hasText(text: string): boolean {
  return text.trim().length > 0;
}
