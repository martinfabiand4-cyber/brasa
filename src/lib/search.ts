/** How many results one search collects before it stops and says so. */
export const SEARCH_LIMIT = 300;

/** Characters of text shown on each side of a match. */
const CONTEXT_UNITS = 60;

export interface TextMatch {
  /** UTF-16 offsets in the searched text, so a DOM Range can be built from them. */
  start: number;
  end: number;
  before: string;
  match: string;
  after: string;
}

/**
 * One character, folded so case and accents do not matter: "Canción" matches
 * "cancion", the way a browser's find bar behaves.
 */
function fold(ch: string): string {
  const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.toLowerCase() || ch.toLowerCase();
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function contextBefore(text: string, start: number): string {
  let from = Math.max(0, start - CONTEXT_UNITS);
  if (from > 0 && isLowSurrogate(text.charCodeAt(from))) from += 1;
  const prefix = from > 0 ? "…" : "";
  return prefix + text.slice(from, start).replace(/\s+/g, " ");
}

function contextAfter(text: string, end: number): string {
  let to = Math.min(text.length, end + CONTEXT_UNITS);
  if (to < text.length && isHighSurrogate(text.charCodeAt(to - 1))) to -= 1;
  const suffix = to < text.length ? "…" : "";
  return text.slice(end, to).replace(/\s+/g, " ") + suffix;
}

/**
 * Every non-overlapping occurrence of `query` in `text`, in reading order.
 * Runs of whitespace count as one space on both sides, so a phrase still matches
 * when the source wraps its lines.
 */
export function findMatches(text: string, query: string): TextMatch[] {
  const needle = Array.from(query.trim().replace(/\s+/g, " "), fold);
  if (needle.length === 0) return [];

  // Work on whole characters so the offsets we report point at real text.
  const chars: string[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const ch of text) {
    chars.push(ch);
    offsets.push(offset);
    offset += ch.length;
  }

  const folded: string[] = [];
  const source: number[] = [];
  let previousSpace = false;
  chars.forEach((ch, index) => {
    const space = /\s/.test(ch);
    if (space && previousSpace) return;
    previousSpace = space;
    folded.push(space ? " " : fold(ch));
    source.push(index);
  });

  const matches: TextMatch[] = [];
  for (let i = 0; i + needle.length <= folded.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (folded[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (!found) continue;

    const first = source[i];
    const last = source[i + needle.length - 1];
    const start = offsets[first];
    const end = offsets[last] + chars[last].length;
    matches.push({
      start,
      end,
      before: contextBefore(text, start),
      match: text.slice(start, end),
      after: contextAfter(text, end),
    });
    i += needle.length - 1;
  }
  return matches;
}
