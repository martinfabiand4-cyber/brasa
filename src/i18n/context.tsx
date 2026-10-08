import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { en, es, type DictionaryKey } from "./dictionaries";

export type Translate = (key: DictionaryKey, vars?: Record<string, string | number>) => string;

const dictionaries = { es, en } as const;

/** Replaces {name} placeholders. Unknown placeholders are left visible on purpose. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

const I18nContext = createContext<{ locale: "es" | "en"; t: Translate }>({
  locale: "es",
  t: (key, vars) => interpolate(es[key], vars),
});

export function I18nProvider({ locale, children }: { locale: "es" | "en"; children: ReactNode }) {
  const t = useCallback<Translate>(
    (key, vars) => interpolate(dictionaries[locale][key], vars),
    [locale],
  );
  const value = useMemo(() => ({ locale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
