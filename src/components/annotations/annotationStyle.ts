import type { CSSProperties } from "react";
import type { FontFamily, Typography } from "../../lib/annotations";

/** Font stacks for notes and comments. The reading fonts come from the app's own tokens. */
export const FONT_STACKS: Record<FontFamily, string> = {
  sans: "var(--font-ui)",
  serif: "var(--font-read)",
  mono: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
  hand: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
};

interface PlacedStyle {
  x: number;
  y: number;
  color: string;
  typography: Typography;
}

/**
 * The custom properties that size and color a note or comment. Sizes are in
 * reference units; the CSS turns them into pixels for the page's current width.
 */
export function annotationStyle({ x, y, color, typography }: PlacedStyle): CSSProperties {
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${(1 - x) * 100}%`,
    "--ann-bg": color,
    "--ann-ink": typography.color,
    "--ann-size": String(typography.size),
    "--ann-margin": String(typography.margin),
    "--ann-lh": String(typography.lineHeight),
    "--ann-font": FONT_STACKS[typography.font],
  } as CSSProperties;
}

/** Removes one trailing line break, which browsers add after typing at the end of a box. */
export function cleanEditedText(value: string): string {
  return value.replace(/\n+$/, "");
}
