/**
 * Zoom that stays under the pointer. Before a zoom step the spot of the page under the
 * pointer is recorded as fractions of the page's size. Once the page has its new size,
 * the same spot is scrolled back under the pointer, so zooming opens the part being looked at.
 */
export interface ZoomAnchor {
  /** The page element the pointer was over. Its size changes with the zoom. */
  page: HTMLElement;
  /** The spot under the pointer, as fractions of the page's width and height, from 0 to 1. */
  fx: number;
  fy: number;
  /** Pointer position in viewport pixels. */
  x: number;
  y: number;
  /** The zoom the step started from. A step that did not change the zoom has nothing to keep. */
  from: number;
}

/** Every page the PDF readers draw, in paged and in continuous mode. */
const PAGE_SELECTOR = ".pdf-page, .pdf-scroll__page";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Records the spot under the pointer. Between pages the nearest page is used, so the
 * anchor still means something when the pointer is in the margin.
 */
export function captureZoomAnchor(host: HTMLElement, x: number, y: number, from: number): ZoomAnchor | null {
  let best: { page: HTMLElement; distance: number } | null = null;
  for (const page of host.querySelectorAll<HTMLElement>(PAGE_SELECTOR)) {
    const rect = page.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { page, distance };
    if (distance === 0) break;
  }
  if (!best) return null;
  const rect = best.page.getBoundingClientRect();
  return {
    page: best.page,
    fx: clamp01((x - rect.left) / rect.width),
    fy: clamp01((y - rect.top) / rect.height),
    x,
    y,
    from,
  };
}

/**
 * Scrolls the scroller so the anchored spot is back under the pointer. Call it once the
 * new size is in the layout. The browser clamps the scroll, so edges stay in reach.
 */
export function restoreZoomAnchor(scroller: HTMLElement, anchor: ZoomAnchor): void {
  const rect = anchor.page.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  scroller.scrollLeft += rect.left + anchor.fx * rect.width - anchor.x;
  scroller.scrollTop += rect.top + anchor.fy * rect.height - anchor.y;
}
