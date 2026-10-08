import { useEffect, useId } from "react";
import { useI18n } from "../i18n/context";

interface BrightnessPopoverProps {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
}

/** A light control for the reading area. Changes apply at once; a click outside closes it. */
export default function BrightnessPopover({ value, onChange, onClose }: BrightnessPopoverProps) {
  const { t } = useI18n();
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim scrim--clear" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="glass popover" role="dialog" aria-labelledby={titleId}>
        <div className="field__label">
          <span id={titleId}>{t("brightness")}</span>
          <span className="field__hint">{value} %</span>
        </div>
        <input
          type="range"
          min={30}
          max={100}
          step={1}
          value={value}
          aria-label={t("brightness")}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
