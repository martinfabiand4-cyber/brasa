/** Limits and steps for the two zoom controls: PDF zoom and EPUB text size. */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;
export const FONT_MIN = 70;
export const FONT_MAX = 200;
export const FONT_STEP = 10;

/** Wheel movement, in pixels, needed for one zoom step. Trackpads send many small events. */
const WHEEL_THRESHOLD = 40;

export type ZoomDirection = 1 | -1;

export function stepZoom(current: number, direction: ZoomDirection): number {
  const next = Math.round((current + direction * ZOOM_STEP) * 10) / 10;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
}

export function stepFontSize(current: number, direction: ZoomDirection): number {
  const next = Math.round((current + direction * FONT_STEP) / FONT_STEP) * FONT_STEP;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, next));
}

/**
 * Turns Ctrl + wheel into zoom steps. Plain wheel keeps scrolling and turning
 * pages as usual; Ctrl is the same gesture browsers and PDF viewers use to zoom.
 */
export function createWheelZoom(onStep: (direction: ZoomDirection) => void): (event: WheelEvent) => void {
  let accumulated = 0;
  return (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    accumulated += event.deltaY;
    if (Math.abs(accumulated) < WHEEL_THRESHOLD) return;
    onStep(accumulated < 0 ? 1 : -1);
    accumulated = 0;
  };
}
