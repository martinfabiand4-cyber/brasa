/**
 * Reads what a PDF says when its pages are images: which pages have no text
 * layer, what the text says once it has been read, and which lines are chapter
 * headings. The result drives the automatic index and the search over scans.
 */

/** A page with fewer letters or digits than this is treated as an image with no text. */
export const TEXT_LAYER_MIN_CHARS = 20;

/** A heading line that appears on more pages than this is a running header, not a chapter. */
const RUNNING_HEADER_PAGES = 3;
const MAX_HEADINGS = 300;

export interface PageText {
  /** 1-based page number. */
  page: number;
  text: string;
}

export interface Heading {
  label: string;
  /** 0 for chapters and parts, 1 for sections nested under them. */
  depth: number;
  page: number;
}

export interface TextAnalysis {
  version: 1;
  /** When the analysis last ran, or null when it has not run yet. */
  analyzedAt: number | null;
  /** Pages with no text layer, in order. */
  textless: number[];
  /** Text read by OCR, keyed by page number. */
  pages: Record<string, string>;
  headings: Heading[];
}

export function countTextChars(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

export function needsOcr(textLayer: string): boolean {
  return countTextChars(textLayer) < TEXT_LAYER_MIN_CHARS;
}

const CHAPTER = /^(cap[ií]tulo|chapter|parte|part|lecci[oó]n|lesson|unidad|unit)\s+([0-9]+|[ivxlcdm]+|[a-záéíóúñ]+)\b/i;
const SECTION = /^(secci[oó]n|section|tema|topic)\s+([0-9.]+|[ivxlcdm]+)\b/i;
const NUMBERED = /^[0-9]{1,2}(\.[0-9]{1,2})?\s+[A-ZÁÉÍÓÚÑ][^\n]{2,60}$/;
const UPPERCASE = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.:,'’-]{3,60}$/;

interface Candidate {
  label: string;
  key: string;
  depth: number;
  page: number;
}

/** The depth a line suggests when it looks like a heading, or null when it does not. */
function headingDepth(line: string): number | null {
  if (CHAPTER.test(line)) return 0;
  if (SECTION.test(line)) return 1;
  if (NUMBERED.test(line)) return 1;
  if (UPPERCASE.test(line) && /\p{L}{4,}/u.test(line) && !/\d/.test(line)) return 0;
  return null;
}

/**
 * Finds chapter and section headings in the text of each page. Running headers,
 * which repeat on many pages, are dropped so the index only lists real headings.
 */
export function detectHeadings(pages: readonly PageText[]): Heading[] {
  const candidates: Candidate[] = [];
  for (const { page, text } of pages) {
    const seen = new Set<string>();
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (line.length < 4 || line.length > 80) continue;
      const depth = headingDepth(line);
      if (depth === null) continue;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ label: line, key, depth, page });
    }
  }

  const pagesPerKey = new Map<string, Set<number>>();
  for (const item of candidates) {
    const set = pagesPerKey.get(item.key) ?? new Set<number>();
    set.add(item.page);
    pagesPerKey.set(item.key, set);
  }

  return candidates
    .filter((item) => (pagesPerKey.get(item.key)?.size ?? 0) <= RUNNING_HEADER_PAGES)
    .slice(0, MAX_HEADINGS)
    .map(({ label, depth, page }) => ({ label, depth, page }));
}

export function emptyAnalysis(): TextAnalysis {
  return { version: 1, analyzedAt: null, textless: [], pages: {}, headings: [] };
}

export function normalizeAnalysis(raw: unknown): TextAnalysis {
  if (typeof raw !== "object" || raw === null) return emptyAnalysis();
  const input = raw as Partial<TextAnalysis>;
  const pages: Record<string, string> = {};
  if (typeof input.pages === "object" && input.pages !== null) {
    for (const [key, value] of Object.entries(input.pages)) {
      if (typeof value === "string" && /^[0-9]+$/.test(key)) pages[key] = value;
    }
  }
  return {
    version: 1,
    analyzedAt: typeof input.analyzedAt === "number" ? input.analyzedAt : null,
    textless: Array.isArray(input.textless)
      ? input.textless.filter((value): value is number => Number.isInteger(value) && value > 0)
      : [],
    pages,
    headings: Array.isArray(input.headings)
      ? input.headings.filter(
          (item): item is Heading =>
            typeof item?.label === "string" &&
            Number.isInteger(item.page) &&
            item.page > 0 &&
            (item.depth === 0 || item.depth === 1),
        )
      : [],
  };
}

/** Tidies text read by OCR: no stray spaces at line ends, no runs of blank lines. */
export function tidyOcrText(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== ""))
    .join("\n")
    .trim();
}
