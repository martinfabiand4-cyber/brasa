import { describe, expect, it } from "vitest";
import {
  DEFAULT_TYPOGRAPHY,
  INK_COLORS,
  inkPath,
  normalizeAnnotation,
  normalizeAnnotationFile,
  normalizeStroke,
  normalizeTemplate,
  normalizeTypography,
  positionIn,
  REFERENCE_WIDTH,
  scaledPx,
  shouldAddPoint,
} from "./annotations";

describe("normalizeTypography", () => {
  it("keeps valid values and clamps the numbers into their limits", () => {
    const typo = normalizeTypography({ font: "serif", color: "#B3122E", size: 99, margin: -4, lineHeight: 1.8 });
    expect(typo).toEqual({ font: "serif", color: "#B3122E", size: 36, margin: 0, lineHeight: 1.8 });
  });

  it("falls back to the defaults for anything it does not recognize", () => {
    expect(normalizeTypography({ font: "comic", color: "red", size: "big" })).toEqual(DEFAULT_TYPOGRAPHY);
    expect(normalizeTypography(null)).toEqual(DEFAULT_TYPOGRAPHY);
  });
});

describe("normalizeTemplate", () => {
  it("rejects a template without a kind", () => {
    expect(normalizeTemplate({ design: "postit" })).toBeNull();
  });

  it("uses a design that belongs to the kind, and falls back to that kind's first design", () => {
    expect(normalizeTemplate({ kind: "note", design: "bubble" })?.design).toBe("postit");
    expect(normalizeTemplate({ kind: "comment", design: "grid" })?.design).toBe("bubble");
    expect(normalizeTemplate({ kind: "comment", design: "box" })?.design).toBe("box");
  });
});

describe("normalizeAnnotation", () => {
  it("drops annotations with no anchor, since they could never be shown", () => {
    expect(normalizeAnnotation({ kind: "note", anchor: "", x: 0.2, y: 0.2 })).toBeNull();
  });

  it("keeps positions on the page and never shows the open state from disk", () => {
    const note = normalizeAnnotation({ id: "a1", kind: "note", anchor: "3", x: 2, y: -1, text: "hola" });
    expect(note).toMatchObject({ id: "a1", anchor: "3", x: 1, y: 0, text: "hola" });
    expect(note).not.toHaveProperty("open");
  });
});

describe("normalizeStroke", () => {
  it("drops a stray coordinate at the end instead of rejecting the whole stroke", () => {
    const stroke = normalizeStroke({ anchor: "1", points: [0.1, 0.2, 0.3, 0.4, 0.5], size: 14 });
    expect(stroke?.points).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("rejects a stroke with fewer than one point", () => {
    expect(normalizeStroke({ anchor: "1", points: [0.5] })).toBeNull();
  });

  it("uses the default ink color when the stored one is not a color", () => {
    expect(normalizeStroke({ anchor: "1", points: [0, 0, 1, 1], color: "blue" })?.color).toBe(INK_COLORS[0]);
  });
});

describe("normalizeAnnotationFile", () => {
  it("returns an empty file for a damaged or missing document", () => {
    expect(normalizeAnnotationFile("basura")).toEqual({ version: 1, annotations: [], strokes: [] });
    expect(normalizeAnnotationFile({ annotations: "no", strokes: null })).toEqual({
      version: 1,
      annotations: [],
      strokes: [],
    });
  });
});

describe("positionIn", () => {
  it("turns a client position into fractions of the box, clamped to it", () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(positionIn(300, 150, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(positionIn(50, 400, rect)).toEqual({ x: 0, y: 1 });
  });
});

describe("scaledPx", () => {
  it("makes sizes scale with the page, so zooming keeps them in proportion", () => {
    expect(scaledPx(REFERENCE_WIDTH, 900)).toBe(900);
    expect(scaledPx(18, REFERENCE_WIDTH * 2)).toBe(36);
  });
});

describe("shouldAddPoint", () => {
  it("skips points that barely moved, so a slow stroke does not carry thousands of points", () => {
    expect(shouldAddPoint([0.5, 0.5], 0.5005, 0.5)).toBe(false);
    expect(shouldAddPoint([0.5, 0.5], 0.52, 0.5)).toBe(true);
  });
});

describe("inkPath", () => {
  it("draws a single point as a tiny dash so it still shows", () => {
    expect(inkPath([0.5, 0.5], 100, 200)).toBe("M50 100 l0.01 0");
  });

  it("starts at the first point, curves through the middle ones and ends on the last", () => {
    const d = inkPath([0, 0, 0.5, 0.5, 1, 0], 100, 100);
    expect(d.startsWith("M0 0")).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(1);
    expect(d.endsWith("L100 0")).toBe(true);
  });
});
