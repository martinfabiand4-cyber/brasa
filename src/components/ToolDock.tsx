import type { ReactNode } from "react";

export interface DockItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Highlights the tool while its panel is open. */
  active?: boolean;
  onSelect: () => void;
}

interface ToolDockProps {
  label: string;
  items: DockItem[];
}

/**
 * The reading tools, as a floating glass column at the edge of the reader.
 * It slides away with the rest of the chrome, so it never covers the page when hidden.
 */
export default function ToolDock({ label, items }: ToolDockProps) {
  return (
    <nav className="dock" aria-label={label}>
      <div className="glass dock__pill">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="dock__tool"
            aria-label={item.label}
            aria-pressed={item.active ?? false}
            onClick={item.onSelect}
          >
            <span className="dock__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="dock__tip" aria-hidden="true">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
