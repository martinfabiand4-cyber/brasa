import { describe, expect, it } from "vitest";
import { baseName, detectFormat, hueFromString, titleFromFileName } from "./format";
import { sha256Hex } from "./hash";
import { clampPage, resolvePageTurn, pdfProgress, percentOf, tapZoneFor } from "./reading";
import { DEFAULT_SETTINGS, resolveLocale, sanitizeSettings } from "./settings";
import { sortBooks } from "./sort";
import { BOOKMARK_COLORS, DEFAULT_BOOKMARK_COLOR, normalizeBookmark } from "./bookmarks";
import type { Book } from "./types";

function book(overrides: Partial<Book> & { id: string; title: string }): Book {
  return {
    author: "",
    format: "epub",
    fileName: `${overrides.title}.epub`,
    storedPath: `books/${overrides.id}.epub`,
    addedAt: 0,
    lastOpenedAt: null,
    favorite: false,
    progress: 0,
    position: null,
    hue: 0,
    ...overrides,
  };
}

describe("detectFormat", () => {
  it("accepts EPUB and PDF regardless of case", () => {
    expect(detectFormat("novela.epub")).toBe("epub");
    expect(detectFormat("Manual.PDF")).toBe("pdf");
  });

  it("rejects other formats and names without an extension", () => {
    expect(detectFormat("libro.mobi")).toBeNull();
    expect(detectFormat("sinextension")).toBeNull();
    expect(detectFormat("comic.cbz")).toBeNull();
  });
});

describe("titleFromFileName", () => {
  it("cleans separators and the extension", () => {
    expect(titleFromFileName("Mi_libro-final.v2.pdf")).toBe("Mi libro final v2");
  });

  it("never returns an empty title", () => {
    expect(titleFromFileName(".epub")).toBe("Sin título");
  });
});

describe("baseName", () => {
  it("handles both Windows and Linux separators", () => {
    expect(baseName("C:\\Users\\ana\\Libros\\novela.epub")).toBe("novela.epub");
    expect(baseName("/home/ana/libros/manual.pdf")).toBe("manual.pdf");
    expect(baseName("solo.pdf")).toBe("solo.pdf");
  });
});

describe("sha256Hex", () => {
  it("matches the published SHA-256 digest", async () => {
    const digest = await sha256Hex(new TextEncoder().encode("abc"));
    expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("hueFromString", () => {
  it("is stable for the same seed and stays in the hue range", () => {
    expect(hueFromString("abc")).toBe(hueFromString("abc"));
    const hue = hueFromString("cualquier-titulo");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe("sortBooks", () => {
  const books = [
    book({ id: "1", title: "Zorro", addedAt: 100, lastOpenedAt: null }),
    book({ id: "2", title: "árbol", addedAt: 300, lastOpenedAt: 900 }),
    book({ id: "3", title: "Azul", addedAt: 200, lastOpenedAt: 500 }),
    book({ id: "4", title: "Capítulo 10", addedAt: 50, lastOpenedAt: null }),
    book({ id: "5", title: "Capítulo 2", addedAt: 60, lastOpenedAt: null }),
  ];

  it("sorts alphabetically, ignoring accents and case, with numbers in natural order", () => {
    const titles = sortBooks(books, "alphabetical", "es").map((b) => b.title);
    expect(titles).toEqual(["árbol", "Azul", "Capítulo 2", "Capítulo 10", "Zorro"]);
  });

  it("puts most recently opened first, then never-opened books by import date", () => {
    const ids = sortBooks(books, "recentlyOpened", "es").map((b) => b.id);
    expect(ids).toEqual(["2", "3", "1", "5", "4"]);
  });

  it("puts most recently added first", () => {
    const ids = sortBooks(books, "recentlyAdded", "es").map((b) => b.id);
    expect(ids).toEqual(["2", "3", "1", "5", "4"]);
  });

  it("does not mutate the input array", () => {
    const original = books.map((b) => b.id);
    sortBooks(books, "alphabetical", "es");
    expect(books.map((b) => b.id)).toEqual(original);
  });
});

describe("reading helpers", () => {
  it("maps taps to the outer thirds and the middle", () => {
    expect(tapZoneFor(100, 1000)).toBe("previous");
    expect(tapZoneFor(500, 1000)).toBe("menu");
    expect(tapZoneFor(900, 1000)).toBe("next");
    expect(tapZoneFor(10, 0)).toBe("menu");
  });

  it("clamps progress and formats it as a percentage", () => {
    expect(percentOf(-0.4)).toBe(0);
    expect(percentOf(0.474)).toBe(47);
    expect(percentOf(3)).toBe(100);
    expect(percentOf(Number.NaN)).toBe(0);
  });

  it("keeps page numbers inside the document", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(4.6, 10)).toBe(5);
    expect(clampPage(3, 0)).toBe(1);
  });

  it("computes PDF progress from 1-based pages", () => {
    expect(pdfProgress(1, 4)).toBeCloseTo(0.25);
    expect(pdfProgress(4, 4)).toBe(1);
    expect(pdfProgress(1, 0)).toBe(0);
  });

  it("downgrades slide to fade when reduced motion is requested", () => {
    expect(resolvePageTurn("slide", true)).toBe("fade");
    expect(resolvePageTurn("slide", false)).toBe("slide");
    expect(resolvePageTurn("none", true)).toBe("none");
  });
});

describe("settings", () => {
  it("returns defaults for missing or broken input", () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("roto")).toEqual(DEFAULT_SETTINGS);
  });

  it("drops unknown values and clamps numbers into range", () => {
    const clean = sanitizeSettings({ theme: "azul", pageTurn: "curl", fontSize: 999, zoom: -2 });
    expect(clean.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(clean.pageTurn).toBe(DEFAULT_SETTINGS.pageTurn);
    expect(clean.fontSize).toBe(200);
    // Zoom never goes below the whole page fitting its margins.
    expect(clean.zoom).toBe(1);
  });

  it("resolves auto locale from the system language and only supports es or en", () => {
    expect(resolveLocale("auto", "es-CL")).toBe("es");
    expect(resolveLocale("auto", "fr-FR")).toBe("en");
    expect(resolveLocale("en", "es-CL")).toBe("en");
  });
});

describe("brightness and bookmarks", () => {
  it("keeps brightness between 30 and 100, with 100 as the default", () => {
    expect(DEFAULT_SETTINGS.brightness).toBe(100);
    expect(sanitizeSettings({ brightness: 5 }).brightness).toBe(30);
    expect(sanitizeSettings({ brightness: 250 }).brightness).toBe(100);
    expect(sanitizeSettings({ brightness: "alto" }).brightness).toBe(100);
    expect(sanitizeSettings({ brightness: 64 }).brightness).toBe(64);
  });

  it("gives bookmarks saved before designs existed a ribbon in the default color", () => {
    const old = normalizeBookmark({ id: "m1", bookId: "b1", position: "3", createdAt: 10 });
    expect(old.design).toBe("ribbon");
    expect(old.color).toBe(DEFAULT_BOOKMARK_COLOR);
    expect(old.label).toBe("");
  });

  it("drops a color that is not in the palette", () => {
    const bookmark = normalizeBookmark({ id: "m2", bookId: "b1", position: "1", color: "#123456", design: "star" as never });
    expect(bookmark.color).toBe(DEFAULT_BOOKMARK_COLOR);
    expect(bookmark.design).toBe("ribbon");
  });

  it("keeps a valid name, design and color as they are", () => {
    const bookmark = normalizeBookmark({
      id: "m3",
      bookId: "b1",
      position: "7",
      label: "Capítulo difícil",
      design: "flag",
      color: BOOKMARK_COLORS[3],
    });
    expect(bookmark).toMatchObject({ label: "Capítulo difícil", design: "flag", color: BOOKMARK_COLORS[3] });
  });
});
