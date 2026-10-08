import type { BookFormat } from "./types";

/** Returns the book format for a file name, or null when the app does not read it. */
export function detectFormat(fileName: string): BookFormat | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  if (ext === "epub") return "epub";
  if (ext === "pdf") return "pdf";
  return null;
}

/** The file name at the end of a path, for Windows and Linux separators alike. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** Turns "Mi_libro-final.v2.pdf" into "Mi libro final v2". */
export function titleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const spaced = withoutExt.replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced.length > 0 ? spaced : "Sin título";
}

/** Deterministic hue from a string, so each book keeps the same cover color. */
export function hueFromString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function createId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
