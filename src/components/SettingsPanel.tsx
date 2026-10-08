import { X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/context";
import type { Flow, Locale, PageTurn, Settings, Theme } from "../lib/types";
import type { LibraryActions } from "../state/useLibrary";

interface SettingsPanelProps {
  lib: LibraryActions;
  onClose: () => void;
}

export default function SettingsPanel({ lib, onClose }: SettingsPanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { settings } = lib;

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch: Partial<Settings>) => lib.updateSettings(patch);

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <header className="sheet__header">
          <h2 id={titleId}>{t("settings")}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("close")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <Field label={t("language")}>
          <Segments<Locale>
            value={settings.locale}
            onChange={(locale) => set({ locale })}
            options={[
              { value: "auto", label: t("languageAuto") },
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
            ]}
          />
        </Field>

        <Field label={t("theme")}>
          <Segments<Theme>
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: "noche", label: t("themeNight") },
              { value: "papel", label: t("themePaper") },
            ]}
          />
        </Field>

        <Field label={t("pageTurn")}>
          <Segments<PageTurn>
            value={settings.pageTurn}
            onChange={(pageTurn) => set({ pageTurn })}
            options={[
              { value: "slide", label: t("turnSlide") },
              { value: "fade", label: t("turnFade") },
              { value: "none", label: t("turnNone") },
            ]}
          />
        </Field>

        <Field label={t("flow")}>
          <Segments<Flow>
            value={settings.flow}
            onChange={(flow) => set({ flow })}
            options={[
              { value: "paginated", label: t("flowPaginated") },
              { value: "scroll", label: t("flowScroll") },
            ]}
          />
        </Field>

        <Field label={t("textSize")} hint={`${settings.fontSize} %`}>
          <input
            type="range"
            min={70}
            max={200}
            step={5}
            value={settings.fontSize}
            onChange={(event) => set({ fontSize: Number(event.target.value) })}
            aria-label={t("textSize")}
          />
        </Field>

        <Field label={t("brightness")} hint={`${settings.brightness} %`}>
          <input
            type="range"
            min={30}
            max={100}
            step={1}
            value={settings.brightness}
            onChange={(event) => set({ brightness: Number(event.target.value) })}
            aria-label={t("brightness")}
          />
        </Field>

        <Field label={t("zoom")} hint={`${settings.zoom.toFixed(1)}×`}>
          <input
            type="range"
            min={0.6}
            max={3}
            step={0.1}
            value={settings.zoom}
            onChange={(event) => set({ zoom: Number(event.target.value) })}
            aria-label={t("zoom")}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="field">
      <div className="field__label">
        <span>{label}</span>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Segments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented segmented--wide" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
