import { describe, expect, it } from "vitest";
import { countTextChars, detectHeadings, needsOcr, normalizeAnalysis, tidyOcrText } from "./textAnalysis";

describe("needsOcr", () => {
  it("treats a page with almost no letters as an image", () => {
    expect(needsOcr("")).toBe(true);
    expect(needsOcr("  12 ·  ")).toBe(true);
  });

  it("leaves pages with real text alone", () => {
    expect(needsOcr("Un párrafo normal de lectura con suficientes letras.")).toBe(false);
    expect(countTextChars("ñandú 42!")).toBe(7);
  });
});

describe("detectHeadings", () => {
  it("finds chapters, numbered sections and uppercase titles, with their pages", () => {
    const headings = detectHeadings([
      { page: 1, text: "Capítulo 1\nEl comienzo de la historia\nTexto normal del libro." },
      { page: 4, text: "1.2 Historia de la imprenta\nOtra frase cualquiera." },
      { page: 9, text: "INTRODUCCIÓN\nLa obra empieza aquí." },
    ]);
    expect(headings).toEqual([
      { label: "Capítulo 1", depth: 0, page: 1 },
      { label: "1.2 Historia de la imprenta", depth: 1, page: 4 },
      { label: "INTRODUCCIÓN", depth: 0, page: 9 },
    ]);
  });

  it("drops running headers that repeat on many pages", () => {
    const pages = Array.from({ length: 8 }, (_, i) => ({ page: i + 1, text: "CAPITULO DE PRUEBA\nTexto." }));
    pages[4] = { page: 5, text: "CAPÍTULO 2\nOtro texto." };
    expect(detectHeadings(pages)).toEqual([{ label: "CAPÍTULO 2", depth: 0, page: 5 }]);
  });

  it("ignores ordinary sentences and numbers that merely start with a digit", () => {
    expect(detectHeadings([{ page: 1, text: "2024 fue un año largo.\nEl texto sigue sin títulos aquí." }])).toEqual([]);
  });
});

describe("normalizeAnalysis", () => {
  it("returns an empty analysis for missing or damaged data", () => {
    expect(normalizeAnalysis(undefined)).toMatchObject({ analyzedAt: null, textless: [], pages: {}, headings: [] });
  });

  it("drops entries that cannot be used", () => {
    const analysis = normalizeAnalysis({
      analyzedAt: 5,
      textless: [2, -1, "x", 4],
      pages: { "2": "texto", x: "no", "3": 7 },
      headings: [{ label: "Cap", depth: 0, page: 2 }, { label: "Malo", depth: 3, page: 1 }],
    });
    expect(analysis.textless).toEqual([2, 4]);
    expect(analysis.pages).toEqual({ "2": "texto" });
    expect(analysis.headings).toEqual([{ label: "Cap", depth: 0, page: 2 }]);
  });
});

describe("tidyOcrText", () => {
  it("removes stray spaces and keeps at most one blank line in a row", () => {
    expect(tidyOcrText("  Hola   mundo  \n\n\n\nSegundo  \n")).toBe("Hola mundo\n\nSegundo");
  });
});
