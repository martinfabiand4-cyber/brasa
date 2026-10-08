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
import { positionIn } from "../../lib/annotations";
import type { ShownAnnotation } from "../../state/useAnnotations";
import { useAnnotationScene } from "./AnnotationContext";
import { annotationStyle, cleanEditedText } from "./annotationStyle";

/** Pointer movement, in pixels, before a press counts as a drag rather than a click. */
const DRAG_SLOP = 4;

/** Distance, in pixels, from the dot to the top-left corner of the open note or comment. */
const BODY_OFFSET = 8;

interface AnnotationItemProps {
  item: ShownAnnotation;
}

/**
 * One note or comment on a page. Closed, it is a dot the person can drag anywhere
 * on the page; a click opens it into its note or bubble, where it can be typed in.
 */
export default function AnnotationItem({ item }: AnnotationItemProps) {
  const { t } = useI18n();
  const scene = useAnnotationScene();
  const textRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  const store = scene?.store;

  // An open note or comment grows downward, but it stays on its page: when its text runs past the
  // bottom edge it moves up by the overflow, and never above the top of the page.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const layer = body?.closest<HTMLElement>(".ann-layer");
    if (!body || !layer) return;
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
  }, [item.y]);

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
   * Presses on the dot or the bar drag the item across its page. A press that does
   * not move is a click, and the callback runs for it.
   */
  function beginDrag(event: PointerEvent<HTMLElement>, onClick?: () => void) {
    if (!store || (event.button !== 0 && event.button !== 2)) return;
    const handle = event.currentTarget;
    const layer = handle.closest<HTMLElement>(".ann-layer");
    if (!layer) return;
    event.stopPropagation();
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const onMove = (move: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_SLOP) return;
      moved = true;
      const place = positionIn(move.clientX, move.clientY, layer.getBoundingClientRect());
      store.move(item.id, place.x, place.y);
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
  const kindLabel = item.kind === "note" ? t("toolNote") : t("toolComment");

  return (
    <div
      className={`ann-item ann-item--${item.kind}${item.open ? " is-open" : ""}`}
      style={annotationStyle({ x: item.x, y: item.y, color: item.color, typography })}
      data-ann-id={item.id}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="ann-dot"
        aria-label={`${kindLabel}: ${item.open ? t("annotationOpen") : t("annotationClosed")}`}
        aria-expanded={item.open}
        tabIndex={item.open ? -1 : 0}
        onPointerDown={(event) => beginDrag(event, () => store?.setOpen(item.id, true))}
        onKeyDown={onDotKey}
      />
      <div
        ref={bodyRef}
        className={`ann-body ann-body--${item.design}`}
        style={{ top: BODY_OFFSET - lift }}
        aria-hidden={!item.open}
      >
        <div className="ann-bar" onPointerDown={(event) => beginDrag(event)} title={t("annotationMove")}>
          <button
            type="button"
            className="ann-bar__remove"
            aria-label={t("annotationDelete")}
            tabIndex={item.open ? 0 : -1}
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
          aria-readonly={!item.open}
          contentEditable={item.open}
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder={t("annotationPlaceholder")}
          data-empty={item.text === "" ? "" : undefined}
          onInput={onInput}
          onPaste={onPaste}
        />
      </div>
    </div>
  );
}
