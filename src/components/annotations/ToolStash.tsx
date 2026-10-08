import type { PointerEvent } from "react";
import { useI18n } from "../../i18n/context";
import type { DictionaryKey } from "../../i18n/dictionaries";
import type { AnnotationDesign, StyleTemplate } from "../../lib/annotations";

const DESIGN_KEYS: Record<AnnotationDesign, DictionaryKey> = {
  postit: "designPostit",
  paper: "designPaper",
  grid: "designGrid",
  bubble: "designBubble",
  box: "designBox",
};

interface ToolStashProps {
  label: string;
  templates: StyleTemplate[];
  /** A press on a saved tool. Moving it drops a new note or comment on the page. */
  onPress: (template: StyleTemplate, event: PointerEvent<HTMLButtonElement>) => void;
}

/**
 * The saved notes and comments, one colored dot each, under the tool column.
 * They are dragged from here onto the page.
 */
export default function ToolStash({ label, templates, onPress }: ToolStashProps) {
  const { t } = useI18n();
  if (templates.length === 0) return null;
  return (
    <nav className="stash glass" aria-label={label}>
      {templates.map((template) => {
        const kind = template.kind === "note" ? t("toolNote") : t("toolComment");
        const name = `${kind}: ${t(DESIGN_KEYS[template.design])}`;
        return (
          <button
            key={template.id}
            type="button"
            className={`stash__dot stash__dot--${template.kind}`}
            style={{ background: template.color }}
            aria-label={name}
            title={name}
            onPointerDown={(event) => {
              if (event.button === 0 || event.button === 2) onPress(template, event);
            }}
            onContextMenu={(event) => event.preventDefault()}
          />
        );
      })}
    </nav>
  );
}
