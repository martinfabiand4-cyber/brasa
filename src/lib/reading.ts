import type { PageTurn } from "./types";

export type TapZone = "previous" | "menu" | "next";

/**
 * Maps a horizontal tap position to an action. The outer thirds turn the page,
 * the middle toggles the reader chrome.
 */
export function tapZoneFor(x: number, width: number): TapZone {
  if (width <= 0) return "menu";
  const ratio = x / width;
  if (ratio < 0.3) return "previous";
  if (ratio > 0.7) return "next";
  return "menu";
}

/** Clamps progress to the 0 to 1 range and rounds it to a whole percentage. */
export function percentOf(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/** Keeps a 1-based page number inside the document. */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0 || !Number.isFinite(page)) return 1;
  return Math.min(totalPages, Math.max(1, Math.round(page)));
}

/** Progress for a PDF page. Pages are 1-based, so the last page reads 100 %. */
export function pdfProgress(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.min(1, Math.max(0, page / totalPages));
}

/**
 * Chooses the page-turn animation. Reduced motion always falls back to a plain
 * fade, and a fade is never longer than a short cross-dissolve.
 */
export function resolvePageTurn(preference: PageTurn, reducedMotion: boolean): PageTurn {
  if (reducedMotion && preference === "slide") return "fade";
  return preference;
}

export const PAGE_TURN_MS = 220;
