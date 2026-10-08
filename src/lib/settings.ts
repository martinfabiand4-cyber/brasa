import type { Flow, Locale, PageTurn, Settings, SortMode, Theme } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  locale: "auto",
  theme: "noche",
  sort: "recentlyOpened",
  pageTurn: "slide",
  flow: "paginated",
  fontSize: 100,
  zoom: 1,
};

const LOCALES: readonly Locale[] = ["auto", "es", "en"];
const THEMES: readonly Theme[] = ["noche", "papel"];
const PAGE_TURNS: readonly PageTurn[] = ["slide", "fade", "none"];
const FLOWS: readonly Flow[] = ["paginated", "scroll"];
const SORTS: readonly SortMode[] = ["alphabetical", "recentlyOpened", "recentlyAdded"];

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Merges stored settings over the defaults. Anything unknown or out of range
 * is replaced, so a damaged settings block never breaks the reader.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

  return {
    locale: pick(input.locale, LOCALES, DEFAULT_SETTINGS.locale),
    theme: pick(input.theme, THEMES, DEFAULT_SETTINGS.theme),
    sort: pick(input.sort, SORTS, DEFAULT_SETTINGS.sort),
    pageTurn: pick(input.pageTurn, PAGE_TURNS, DEFAULT_SETTINGS.pageTurn),
    flow: pick(input.flow, FLOWS, DEFAULT_SETTINGS.flow),
    fontSize: clamp(input.fontSize as number, 70, 200, DEFAULT_SETTINGS.fontSize),
    zoom: clamp(input.zoom as number, 0.6, 3, DEFAULT_SETTINGS.zoom),
  };
}

/** Resolves "auto" to a concrete language based on the system locale. */
export function resolveLocale(setting: Locale, systemLanguage: string): "es" | "en" {
  if (setting === "es" || setting === "en") return setting;
  return systemLanguage.toLowerCase().startsWith("es") ? "es" : "en";
}
