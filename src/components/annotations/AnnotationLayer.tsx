import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { inkPath, positionIn, scaledPx, shouldAddPoint, type InkStyle } from "../../lib/annotations";
import AnnotationItem from "./AnnotationItem";
import { useAnnotationScene } from "./AnnotationContext";

interface AnnotationLayerProps {
  /** The page this layer belongs to, in the same form the reader uses for positions. */
  anchor: string;
  /** The size of the page on screen, in CSS pixels. */
  width: number;
  height: number;
  /**
   * The width that notes, comments and ink are sized against. It defaults to the layer's
   * width; a screen-filling layer passes a narrower width so the text keeps a book's size.
   */
  scale?: number;
}

interface LiveStroke {
  points: number[];
  color: string;
  style: InkStyle;
  size: number;
}

/**
 * Notes, comments and ink drawn over one page. The layer ignores the pointer, so
 * the page underneath keeps working, except while the marker is in use.
 */
export default function AnnotationLayer({ anchor, width, height, scale = width }: AnnotationLayerProps) {
  const scene = useAnnotationScene();
  const [live, setLive] = useState<LiveStroke | null>(null);
  const liveRef = useRef<LiveStroke | null>(null);

  if (!scene || width <= 0 || height <= 0) return null;
  const { annotations, strokes, ink, store } = scene;
  const drawing = ink.active;

  function begin(event: PointerEvent<HTMLDivElement>) {
    if (!drawing || event.button !== 0) return;
    const layer = event.currentTarget;
    layer.setPointerCapture(event.pointerId);
    const start = positionIn(event.clientX, event.clientY, layer.getBoundingClientRect());
    const stroke: LiveStroke = { points: [start.x, start.y], color: ink.color, style: ink.style, size: ink.size };
    liveRef.current = stroke;
    setLive(stroke);
  }

  function extend(event: PointerEvent<HTMLDivElement>) {
    const current = liveRef.current;
    if (!current) return;
    const point = positionIn(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (!shouldAddPoint(current.points, point.x, point.y)) return;
    const next = { ...current, points: [...current.points, point.x, point.y] };
    liveRef.current = next;
    setLive(next);
  }

  function finish() {
    const current = liveRef.current;
    if (!current) return;
    liveRef.current = null;
    setLive(null);
    store.addStroke({ anchor, ...current });
  }

  const pageStyle = { width, height, "--page-w": `${scale}px` } as CSSProperties;
  const inks = strokes.filter((stroke) => stroke.anchor === anchor);
  const notes = annotations.filter((item) => item.anchor === anchor);

  return (
    <div
      className={`ann-layer${drawing ? " ann-layer--drawing" : ""}`}
      style={pageStyle}
      data-drawing={drawing ? "" : undefined}
      onPointerDown={begin}
      onPointerMove={extend}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <svg className="ann-ink" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {inks.map((stroke) => (
          <path
            key={stroke.id}
            d={inkPath(stroke.points, width, height)}
            stroke={stroke.color}
            strokeWidth={scaledPx(stroke.size, scale)}
            className={`ann-ink__path ann-ink__path--${stroke.style}`}
          />
        ))}
        {live ? (
          <path
            d={inkPath(live.points, width, height)}
            stroke={live.color}
            strokeWidth={scaledPx(live.size, scale)}
            className={`ann-ink__path ann-ink__path--${live.style}`}
          />
        ) : null}
      </svg>
      {notes.map((item) => (
        <AnnotationItem key={item.id} item={item} />
      ))}
    </div>
  );
}
