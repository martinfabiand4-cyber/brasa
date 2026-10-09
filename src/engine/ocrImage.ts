/**
 * Binarization for the recognizer. A scanned page is rarely evenly lit: one edge is often darker,
 * or a gutter throws a shadow. One threshold for the whole page then turns the paper into noise,
 * so each pixel is compared with its own neighbourhood instead (Sauvola's method).
 *
 * The functions work on RGBA pixels in the layout of ImageData, so they need no DOM and can be
 * tested in plain Node.
 */

export interface Raster {
  width: number;
  height: number;
  /** RGBA, four bytes per pixel, as in ImageData. */
  data: Uint8ClampedArray;
}

/** Half the side of the neighbourhood in pixels: about one line of text at the render width. */
export const WINDOW_RADIUS = 15;
/** How far the local spread lowers the threshold. Higher values start to erase faint strokes. */
export const SAUVOLA_K = 0.25;
/** The spread that counts as full contrast in Sauvola's formula: the midpoint of an 8-bit page. */
const DYNAMIC_RANGE = 128;

/** Replaces every pixel with black ink or white paper, judged against its own neighbourhood. */
export function binarizeRaster(raster: Raster): void {
  const { width, height, data } = raster;
  const count = width * height;
  const gray = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    gray[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
  }
  const paper = sauvolaBinarize(gray, width, height);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = paper[i];
    data[o + 3] = 255;
  }
}

/**
 * Sauvola's threshold: a pixel is ink when it is darker than the mean of its neighbourhood,
 * lowered by the neighbourhood's spread. Each value of the result is 255 (paper) or 0 (ink).
 * Integral images keep the cost linear in the number of pixels.
 */
export function sauvolaBinarize(
  gray: Uint8Array,
  width: number,
  height: number,
  radius = WINDOW_RADIUS,
  k = SAUVOLA_K,
): Uint8Array {
  const stride = width + 1;
  const sum = new Float64Array(stride * (height + 1));
  const squares = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSquares = 0;
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x];
      rowSum += v;
      rowSquares += v * v;
      const at = (y + 1) * stride + (x + 1);
      sum[at] = sum[y * stride + (x + 1)] + rowSum;
      squares[at] = squares[y * stride + (x + 1)] + rowSquares;
    }
  }

  const out = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const topLeft = y0 * stride + x0;
      const topRight = y0 * stride + (x1 + 1);
      const bottomLeft = (y1 + 1) * stride + x0;
      const bottomRight = (y1 + 1) * stride + (x1 + 1);
      const mean = (sum[bottomRight] - sum[topRight] - sum[bottomLeft] + sum[topLeft]) / area;
      const variance =
        (squares[bottomRight] - squares[topRight] - squares[bottomLeft] + squares[topLeft]) / area - mean * mean;
      const deviation = Math.sqrt(Math.max(0, variance));
      const threshold = mean * (1 + k * (deviation / DYNAMIC_RANGE - 1));
      out[y * width + x] = gray[y * width + x] > threshold ? 255 : 0;
    }
  }
  return out;
}
