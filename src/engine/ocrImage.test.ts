import { describe, expect, it } from "vitest";
import { binarizeRaster, sauvolaBinarize, type Raster } from "./ocrImage";

/** A grey raster whose pixel value comes from a function of its coordinates. */
function makeRaster(width: number, height: number, value: (x: number, y: number) => number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const v = value(x, y);
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

function at(raster: Raster, x: number, y: number): number {
  return raster.data[(y * raster.width + x) * 4];
}

describe("binarizeRaster", () => {
  it("leaves a blank page white and fully opaque", () => {
    const raster = makeRaster(60, 40, () => 250);
    binarizeRaster(raster);
    for (let i = 0; i < raster.data.length; i += 4) {
      expect(raster.data.slice(i, i + 4)).toEqual(new Uint8ClampedArray([255, 255, 255, 255]));
    }
  });

  it("turns dark strokes black and keeps the paper white on an evenly lit page", () => {
    const raster = makeRaster(120, 60, (x) => (x >= 50 && x < 58 ? 40 : 235));
    binarizeRaster(raster);
    expect(at(raster, 53, 30)).toBe(0);
    expect(at(raster, 20, 30)).toBe(255);
    expect(at(raster, 100, 30)).toBe(255);
  });

  it("finds the ink on a page that is much darker on one side", () => {
    const width = 240;
    const paper = (x: number) => 120 + Math.round((120 * x) / (width - 1));
    const stroke = (x: number) => x >= 40 && x < 48 || x >= 120 && x < 128 || x >= 200 && x < 208;
    const raster = makeRaster(width, 80, (x) => (stroke(x) ? Math.round(paper(x) * 0.35) : paper(x)));
    binarizeRaster(raster);
    expect(at(raster, 43, 40)).toBe(0);
    expect(at(raster, 123, 40)).toBe(0);
    expect(at(raster, 203, 40)).toBe(0);
    expect(at(raster, 20, 40)).toBe(255);
    expect(at(raster, 150, 40)).toBe(255);
    expect(at(raster, 230, 40)).toBe(255);
  });

  it("is deterministic", () => {
    const build = () => makeRaster(90, 70, (x, y) => ((x * 7 + y * 13) % 50) + 150);
    const a = build();
    const b = build();
    binarizeRaster(a);
    binarizeRaster(b);
    expect(a.data).toEqual(b.data);
  });
});

describe("sauvolaBinarize", () => {
  it("produces only paper (255) and ink (0)", () => {
    const width = 80;
    const height = 50;
    const gray = new Uint8Array(width * height).map((_, i) => (i * 37) % 256);
    const out = sauvolaBinarize(gray, width, height);
    expect(out.length).toBe(width * height);
    for (const value of out) expect(value === 0 || value === 255).toBe(true);
  });

  it("handles the corners, where the neighbourhood is clipped by the page edge", () => {
    const width = 30;
    const height = 30;
    const gray = new Uint8Array(width * height).fill(230);
    gray[0] = 20;
    gray[width * height - 1] = 20;
    const out = sauvolaBinarize(gray, width, height, 4, 0.25);
    expect(out[0]).toBe(0);
    expect(out[width * height - 1]).toBe(0);
    expect(out[width * 15 + 15]).toBe(255);
  });
});
