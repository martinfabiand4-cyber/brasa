import type { ReactNode } from "react";
import type { BookmarkDesign } from "../lib/types";

interface BookmarkIconProps {
  design: BookmarkDesign;
  color: string;
  size?: number;
}

/** The four bookmark designs. Each is drawn in the bookmark's own color. */
const SHAPES: Record<BookmarkDesign, ReactNode> = {
  ribbon: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" fill="currentColor" />,
  tag: (
    <path
      fillRule="evenodd"
      fill="currentColor"
      d="M3 5a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l8.4 8.4a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 12.7A1 1 0 0 1 3 12zM7.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
    />
  ),
  flag: (
    <>
      <rect x="4" y="3" width="2" height="18" rx="1" fill="currentColor" />
      <path d="M7 4h12.5l-3.6 4.5 3.6 4.5H7z" fill="currentColor" />
    </>
  ),
  dot: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.25" />
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </>
  ),
};

export default function BookmarkIcon({ design, color, size = 20 }: BookmarkIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="bookmark-icon" style={{ color }}>
      {SHAPES[design]}
    </svg>
  );
}
