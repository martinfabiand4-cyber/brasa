import { Trash } from "@phosphor-icons/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useI18n } from "../../i18n/context";
import { DEFAULT_NOTE_SIZE, SIZE_LIMITS } from "../../lib/annotations";
import type { ShownAnnotation } from "../../state/useAnnotations";
import { useAnnotationScene } from "./AnnotationContext";
import { annotationStyle, cleanEditedText } from "./annotationStyle";

/** Pointer movement, in pixels, before a press counts as a drag rather than a click. */
const DRAG_SLOP = 4;

/** Distance, in pixels, from the dot to the top-left corner of the open comment. */
const BODY_OFFSET = 8;

type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

interface AnnotationItemProps {
  item: ShownAnnotation;
}

/**
 * One note or comment on a page. A comment is a dot the person can drag anywhere on the page;
 * a click opens it into its bubble. A note is a box that stays where it was put: its size is
 * the person's choice, changed from the corners, and it never folds back into a dot.
 */
export default function AnnotationItem({ item }: AnnotationItemProps) {
  const { t } = useI18n();
  const scene = useAnnotationScene();
  const textRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  const store = scene?.store;

  const isNote = item.kind === "note";
  const isOpen = isNote || item.open;
  const size = isNote
    ? { width: item.width ?? DEFAULT_NOTE_SIZE.width, height: item.height ?? DEFAULT_NOTE_SIZE.height }
    : undefined;

  // An open comment grows downward, but it stays on its page: when its text runs past the
  // bottom edge it moves up by the overflow, and never above the top of the page. A note keeps
  // the size it was given, so it does not move.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const layer = body?.closest<HTMLElement>(".ann-layer");
    if (!body || !layer || isNote) return;
    const fit = () => {
      const pageHeight = layer.clientHeight;
      const top = item.y * pageHeight + BODY_OFFSET;
      const overflow = top + body.offsetHeight - pageHeight;
      setLift(Math.max(0, Math.min(overflow, top)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(body);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [item.y, isNote]);

  // Shows the saved text, but never overwrites what the person is typing right now.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerText !== item.text) el.innerText = item.text;
  }, [item.text]);

  useEffect(() => {
    if (item.open) textRef.current?.focus({ preventScroll: true });
  }, [item.open]);

  /**
   * Presses on the dot or the bar drag the item across its page. The item keeps the distance
   * the pointer moved, so it never jumps to the pointer. A press that does not move is a click.
   */
  function beginDrag(event: PointerEvent<HTMLElement>, onClick?: () => void) {
    if (!store || (event.button !== 0 && event.button !== 2)) return;
    const handle = event.currentTarget;
    const layer = handle.closest<HTMLElement>(".ann-layer");
    const body = bodyRef.current;
    if (!layer || !body) return;
    event.stopPropagation();
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: item.x, y: item.y };
    const pageWidth = layer.clientWidth || 1;
    const pageHeight = layer.clientHeight || 1;
    let moved = false;
    const onMove = (move: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_SLOP) return;
      moved = true;
      // A note stays inside its page. A comment's dot may go anywhere on it.
      const maxX = isNote ? 1 - body.offsetWidth / pageWidth : 1;
      const maxY = isNote ? 1 - body.offsetHeight / pageHeight : 1;
      store.move(
        item.id,
        clamp(origin.x + (move.clientX - startX) / pageWidth, 0, maxX),
        clamp(origin.y + (move.clientY - startY) / pageHeight, 0, maxY),
      );
    };
    const end = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (!moved) onClick?.();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /**
   * A drag on a corner of a note. The corner opposite the one held stays where it is, so the
   * note grows or shrinks toward the pointer. The note never leaves its page or gets too small.
   */
  function beginResize(event: PointerEvent<HTMLButtonElement>, corner: Corner) {
    const body = bodyRef.current;
    const layer = body?.closest<HTMLElement>(".ann-layer");
    if (!store || !body || !layer || !size || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    // Screen pixels per reference unit, measured on the box as drawn, so the box follows the pointer exactly.
    const unit = body.getBoundingClientRect().width / size.width || 1;
    const pageWidth = layer.getBoundingClientRect().width / unit;
    const pageHeight = layer.getBoundingClientRect().height / unit;
    const left0 = item.x * pageWidth;
    const top0 = item.y * pageHeight;
    const right0 = left0 + size.width;
    const bottom0 = top0 + size.height;
    const [minWidth] = SIZE_LIMITS.noteWidth;
    const [minHeight] = SIZE_LIMITS.noteHeight;
    const east = corner.includes("e");
    const south = corner.includes("s");
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (move: globalThis.PointerEvent) => {
      const dx = (move.clientX - startX) / unit;
      const dy = (move.clientY - startY) / unit;
      const left = east ? left0 : clamp(left0 + dx, 0, right0 - minWidth);
      const right = east ? clamp(right0 + dx, left0 + minWidth, pageWidth) : right0;
      const top = south ? top0 : clamp(top0 + dy, 0, bottom0 - minHeight);
      const bottom = south ? clamp(bottom0 + dy, top0 + minHeight, pageHeight) : bottom0;
      store.reshape(item.id, {
        x: left / pageWidth,
        y: top / pageHeight,
        width: right - left,
        height: bottom - top,
      });
    };
    const end = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  function onDotKey(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === "Enter" || event.key === " ") && store) {
      event.preventDefault();
      store.setOpen(item.id, true);
    }
  }

  function onInput() {
    if (store && textRef.current) store.edit(item.id, cleanEditedText(textRef.current.innerText));
  }

  // Plain text only: pasted formatting would change the look the person chose.
  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
  }

  const { typography } = item;
  const kindLabel = isNote ? t("toolNote") : t("toolComment");

  return (
    <div
      className={`ann-item ann-item--${item.kind}${isOpen ? " is-open" : ""}`}
      style={annotationStyle({ x: item.x, y: item.y, color: item.color, typography, size })}
      data-ann-id={item.id}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {isNote ? null : (
        <button
          type="button"
          className="ann-dot"
          aria-label={`${kindLabel}: ${item.open ? t("annotationOpen") : t("annotationClosed")}`}
          aria-expanded={item.open}
          tabIndex={item.open ? -1 : 0}
          onPointerDown={(event) => beginDrag(event, () => store?.setOpen(item.id, true))}
          onKeyDown={onDotKey}
        />
      )}
      <div
        ref={bodyRef}
        className={`ann-body ann-body--${item.design}${isNote ? " ann-body--free" : ""}`}
        style={isNote ? undefined : { top: BODY_OFFSET - lift }}
        aria-hidden={!isOpen}
      >
        <div className="ann-bar" onPointerDown={(event) => beginDrag(event)} title={t("annotationMove")}>
          <button
            type="button"
            className="ann-bar__remove"
            aria-label={t("annotationDelete")}
            tabIndex={isOpen ? 0 : -1}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => store?.remove(item.id)}
          >
            <Trash size={12} aria-hidden="true" />
          </button>
        </div>
        <div
          ref={textRef}
          className="ann-text"
          role="textbox"
          aria-multiline="true"
          aria-label={kindLabel}
          aria-readonly={!isOpen}
          contentEditable={isOpen}
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder={t("annotationPlaceholder")}
          data-empty={item.text === "" ? "" : undefined}
          onInput={onInput}
          onPaste={onPaste}
        />
        {isNote
          ? CORNERS.map((corner) => (
              <button
                key={corner}
                type="button"
                tabIndex={-1}
                aria-label={t("annotationResize")}
                title={t("annotationResize")}
                className={`ann-corner ann-corner--${corner}`}
                onPointerDown={(event) => beginResize(event, corner)}
              />
            ))
          : null}
      </div>
    </div>
  );
}
