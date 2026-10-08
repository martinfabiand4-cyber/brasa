import { describe, expect, it } from "vitest";
import { findMatches } from "./search";

describe("findMatches", () => {
  it("ignores case and accents, like a browser's find bar", () => {
    const hits = findMatches("Canción y cancion, CANCIÓN.", "cancion");
    expect(hits.map((h) => h.match)).toEqual(["Canción", "cancion", "CANCIÓN"]);
  });

  it("reports non-overlapping occurrences in reading order", () => {
    expect(findMatches("aaaa", "aa")).toHaveLength(2);
    expect(findMatches("el perro y el gato", "el").map((h) => h.start)).toEqual([0, 11]);
  });

  it("returns offsets that point at the matched text", () => {
    const text = "Hola, mundo. Adiós mundo.";
    for (const hit of findMatches(text, "mundo")) {
      expect(text.slice(hit.start, hit.end)).toBe("mundo");
    }
  });

  it("treats a wrapped line as a single space", () => {
    const hits = findMatches("hola\n     mundo", "hola mundo");
    expect(hits).toHaveLength(1);
    expect(hits[0].match).toBe("hola\n     mundo");
  });

  it("keeps surrounding text for the results list and marks cut context with an ellipsis", () => {
    const long = `${"x".repeat(200)} destino ${"y".repeat(200)}`;
    const [hit] = findMatches(long, "destino");
    expect(hit.before.startsWith("…")).toBe(true);
    expect(hit.after.endsWith("…")).toBe(true);
    expect(hit.match).toBe("destino");
  });

  it("finds nothing for an empty or blank query", () => {
    expect(findMatches("texto", "")).toEqual([]);
    expect(findMatches("texto", "   ")).toEqual([]);
  });

  it("counts emoji and other astral characters as whole characters", () => {
    const text = "🙂 palabra 🙂 palabra";
    const hits = findMatches(text, "palabra");
    expect(hits).toHaveLength(2);
    expect(text.slice(hits[1].start, hits[1].end)).toBe("palabra");
  });
});
