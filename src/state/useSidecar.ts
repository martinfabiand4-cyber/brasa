import { useCallback, useEffect, useRef, useState } from "react";
import { readSidecar, writeSidecar } from "../lib/storage";

const SAVE_DELAY_MS = 400;

/**
 * A value kept in one file of its own, per book. It is read once when the book
 * opens, changes are saved a moment after they stop, and anything still waiting
 * is saved when the reader closes or the file changes.
 */
export function useSidecar<T>(path: string, normalize: (raw: unknown) => T) {
  const [value, setValue] = useState<T | null>(null);
  const latest = useRef<T | null>(null);
  const pending = useRef<{ path: string; value: T } | null>(null);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const waiting = pending.current;
    pending.current = null;
    if (waiting) void writeSidecar(waiting.path, waiting.value).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    latest.current = null;
    setValue(null);
    readSidecar(path)
      .then((raw) => normalize(raw))
      .catch(() => normalize(null))
      .then((loaded) => {
        if (cancelled) return;
        latest.current = loaded;
        setValue(loaded);
      });
    return () => {
      cancelled = true;
      flush();
    };
    // The normalizer is a fixed module function, so only the path decides a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, flush]);

  // Saves whatever is still waiting when the reader closes.
  useEffect(() => flush, [flush]);

  const update = useCallback(
    (change: (current: T) => T) => {
      const current = latest.current;
      if (current === null) return;
      const next = change(current);
      latest.current = next;
      setValue(next);
      pending.current = { path, value: next };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [path, flush],
  );

  return { value, update };
}
