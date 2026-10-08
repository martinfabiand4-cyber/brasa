import { useEffect, useState } from "react";
import { readCoverUrl } from "./storage";

/** Loads a book's stored cover as a URL. Null while loading, or when the book has no cover. */
export function useCover(coverPath: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!coverPath) return;
    let cancelled = false;
    let created: string | null = null;
    readCoverUrl(coverPath)
      .then((next) => {
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        created = next;
        setUrl(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [coverPath]);

  return url;
}
