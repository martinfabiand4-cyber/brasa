/**
 * Limits and steps for the two zoom controls: PDF zoom and EPUB text size.
 * PDF zoom is 1 for the whole page fitted inside its margins. It can go out to
 * 0.6 to see a page smaller than that, in both page and scroll reading.
 */
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
 * Turns the wheel over the page into zoom steps. In page-by-page reading the wheel
 * has nothing else to do, so it zooms on its own. In continuous scrolling the wheel
 * scrolls, so zooming then needs Ctrl, the gesture browsers use for the same thing.
 */
export function createWheelZoom(
  onStep: (direction: ZoomDirection, event: WheelEvent) => void,
  requireCtrl: () => boolean = () => false,
): (event: WheelEvent) => void {
  let accumulated = 0;
  return (event: WheelEvent) => {
    if (requireCtrl() && !event.ctrlKey) return;
    event.preventDefault();
    accumulated += event.deltaY;
    if (Math.abs(accumulated) < WHEEL_THRESHOLD) return;
    // The event that completes a step carries the pointer position the zoom should keep in place.
    onStep(accumulated < 0 ? 1 : -1, event);
    accumulated = 0;
  };
}
