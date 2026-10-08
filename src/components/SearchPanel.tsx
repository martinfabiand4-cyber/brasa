import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/context";
import type { SearchHit } from "../reader/types";
import { SEARCH_LIMIT } from "../lib/search";

export type SearchStatus = "idle" | "searching" | "done";

interface SearchPanelProps {
  query: string;
  status: SearchStatus;
  progress: number;
  hits: SearchHit[];
  truncated: boolean;
  /** Names where a hit is, for example "Página 4" or "Sección 2". */
  describe: (hit: SearchHit) => string;
  onSearch: (query: string) => void;
  onGo: (hit: SearchHit) => void;
  onClose: () => void;
}

/** Waiting this long after the last keystroke keeps the scan from starting on every letter. */
const SEARCH_DELAY_MS = 350;

export default function SearchPanel({
  query,
  status,
  progress,
  hits,
  truncated,
  describe,
  onSearch,
  onGo,
  onClose,
}: SearchPanelProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Start a search once the typing pauses; the last search in progress is cancelled by the reader.
  useEffect(() => {
    if (draft.trim() === query.trim()) return;
    const timer = window.setTimeout(() => onSearch(draft), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, query, onSearch]);

  const percent = Math.round(progress * 100);
  let statusText: string;
  if (status === "searching") statusText = t("searchProgress", { percent });
  else if (status === "done") statusText = hits.length > 0 ? t("searchCount", { count: hits.length }) : t("searchNone", { query: query.trim() });
  else statusText = t("searchStart");

  return (
    <div className="scrim scrim--side" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="drawer drawer--open search-panel" role="dialog" aria-modal="true" aria-label={t("searchPlaceholder")}>
        <header className="search-panel__header">
          <div className="search-panel__field">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              className="search-panel__input"
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch(draft);
              }}
            />
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="search-panel__status" role="status" aria-live="polite">
          <p>{statusText}</p>
          {status === "searching" ? (
            <div className="reader__progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
          ) : null}
          {truncated ? <p className="search-panel__note">{t("searchLimit", { count: SEARCH_LIMIT })}</p> : null}
        </div>

        {hits.length > 0 ? (
          <ol className="search-panel__results">
            {hits.map((hit, index) => (
              <li key={`${hit.position}-${index}`}>
                <button type="button" className="search-panel__hit" onClick={() => onGo(hit)}>
                  <span className="search-panel__where">{describe(hit)}</span>
                  <span className="search-panel__excerpt">
                    {hit.before}
                    <mark>{hit.match}</mark>
                    {hit.after}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </aside>
    </div>
  );
}
