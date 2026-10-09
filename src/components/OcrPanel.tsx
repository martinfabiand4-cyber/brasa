import { ScanSmiley, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { useI18n } from "../i18n/context";
import type { ReaderHandle } from "../reader/types";
import { detectHeadings, needsOcr, type Heading, type PageText, type TextAnalysis } from "../lib/textAnalysis";

type Phase = "scanning" | "ready" | "reading" | "error";

interface OcrPanelProps {
  reader: RefObject<ReaderHandle | null>;
  totalPages: number;
  analysis: TextAnalysis;
  onAnalysis: (change: (current: TextAnalysis) => TextAnalysis) => void;
  /** Creates a bookmark for each heading that has none yet. Returns how many were added. */
  onAddBookmarks: (headings: Heading[]) => number;
  onGo: (page: number) => void;
  onClose: () => void;
}

/** The reason a run failed, in words that can be reported. */
function describeFailure(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/** The text of each page: the text layer, or the recognized text where the layer is empty. */
function mergeText(pages: readonly PageText[], recognized: Record<string, string>): PageText[] {
  return pages.map(({ page, text }) => ({
    page,
    text: needsOcr(text) ? (recognized[String(page)] ?? text) : text,
  }));
}

/**
 * Reads what a PDF says when its pages are images, and finds its chapters. The
 * text is kept with the book, so search and the automatic index keep working
 * the next time it is opened.
 */
export default function OcrPanel({
  reader,
  totalPages,
  analysis,
  onAnalysis,
  onAddBookmarks,
  onGo,
  onClose,
}: OcrPanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [progress, setProgress] = useState(0);
  const [textless, setTextless] = useState<number[]>(analysis.textless);
  const [added, setAdded] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const run = useRef<AbortController | null>(null);
  const pagesRef = useRef<PageText[]>([]);
  const analysisRef = useRef(analysis);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  const scan = useCallback(async () => {
    const handle = reader.current;
    if (!handle?.scanText) {
      setFailure(null);
      setPhase("error");
      return;
    }
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setPhase("scanning");
    setProgress(0);
    setAdded(null);
    setFailure(null);
    try {
      const pages = await handle.scanText({ signal: controller.signal, onProgress: setProgress });
      if (controller.signal.aborted) return;
      pagesRef.current = pages;
      const found = pages.filter((item) => needsOcr(item.text)).map((item) => item.page);
      setTextless(found);
      onAnalysis((current) => ({
        ...current,
        analyzedAt: Date.now(),
        textless: found,
        headings: detectHeadings(mergeText(pages, current.pages)),
      }));
      setPhase("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure(describeFailure(error));
      setPhase("error");
    }
  }, [reader, onAnalysis]);

  useEffect(() => {
    void scan();
    return () => run.current?.abort();
  }, [scan]);

  const pending = textless.filter((page) => !(String(page) in analysis.pages));

  async function readImages() {
    const handle = reader.current;
    if (!handle?.recognize || pending.length === 0) return;
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setPhase("reading");
    setProgress(0);
    setFailure(null);
    try {
      await handle.recognize(pending, {
        signal: controller.signal,
        onPage: (page, text) => {
          onAnalysis((current) => ({ ...current, pages: { ...current.pages, [String(page)]: text } }));
        },
        onProgress: setProgress,
      });
      // Stopping early still keeps what was read, so the index covers those pages too.
      onAnalysis((current) => ({ ...current, headings: detectHeadings(mergeText(pagesRef.current, current.pages)) }));
      setPhase("ready");
    } catch (error) {
      if (controller.signal.aborted) {
        setPhase("ready");
        return;
      }
      setFailure(describeFailure(error));
      setPhase("error");
    }
  }

  function stop() {
    run.current?.abort();
  }

  function addBookmarks() {
    setAdded(onAddBookmarks(analysis.headings));
  }

  const percent = Math.round(progress * 100);
  const message =
    phase === "scanning"
      ? t("ocrScanning", { percent })
      : phase === "reading"
        ? t("ocrReading", { percent })
        : phase === "error"
          ? t("ocrError")
          : textless.length === 0
            ? t("ocrNone")
            : pending.length === 0
              ? t("ocrRead", { count: textless.length })
              : t("ocrNeeded", { count: textless.length, total: totalPages });

  return (
    <aside className="tool-sheet ocr-sheet glass" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="tool-sheet__header">
        <h2 id={titleId}>{t("ocrTitle")}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="tool-sheet__body">
        <p className="tool-sheet__hint" role="status" aria-live="polite">
          {message}
        </p>

        {phase === "scanning" || phase === "reading" ? (
          <div className="ocr-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        ) : null}

        <p className="tool-sheet__hint">{t("ocrLanguages")}</p>

        {phase === "ready" && pending.length > 0 ? (
          <button type="button" className="glass-button glass-button--primary ocr-sheet__action" onClick={() => void readImages()}>
            <ScanSmiley size={16} aria-hidden="true" />
            {t("ocrStart", { count: pending.length })}
          </button>
        ) : null}

        {phase === "reading" ? (
          <button type="button" className="glass-button ocr-sheet__action" onClick={stop}>
            {t("ocrStop")}
          </button>
        ) : null}

        {phase === "error" ? (
          <>
            {failure ? <p className="tool-sheet__hint">{t("ocrDetail", { detail: failure })}</p> : null}
            <button type="button" className="glass-button glass-button--primary ocr-sheet__action" onClick={() => void scan()}>
              {t("ocrRetry")}
            </button>
          </>
        ) : null}

        {phase === "ready" && analysis.headings.length > 0 ? (
          <section className="tool-sheet__section">
            <h3>{t("contentsDetected")}</h3>
            <ol className="ocr-index">
              {analysis.headings.map((heading, index) => (
                <li key={`${heading.page}-${index}`} style={{ paddingLeft: `${heading.depth * 14}px` }}>
                  <button type="button" onClick={() => onGo(heading.page)}>
                    <span>{heading.label}</span>
                    <small>{t("pageShort", { page: heading.page })}</small>
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="glass-button ocr-sheet__action" onClick={addBookmarks}>
              {t("ocrAddBookmarks")}
            </button>
            {added !== null ? <p className="tool-sheet__hint">{t("ocrBookmarksAdded", { count: added })}</p> : null}
          </section>
        ) : phase === "ready" && analysis.analyzedAt !== null ? (
          <p className="tool-sheet__hint">{t("ocrNoHeadings")}</p>
        ) : null}
      </div>
    </aside>
  );
}
