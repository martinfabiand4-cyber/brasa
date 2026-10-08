import { useEffect, useState } from "react";
import { I18nProvider } from "./i18n/context";
import { resolveLocale } from "./lib/settings";
import { useLibrary } from "./state/useLibrary";
import Library from "./views/Library";
import Reader from "./views/Reader";

type View = { name: "library" } | { name: "reader"; bookId: string };

export default function App() {
  const lib = useLibrary();
  const [view, setView] = useState<View>({ name: "library" });
  const locale = resolveLocale(lib.settings.locale, navigator.language);
  const theme = lib.settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);

  if (lib.state.status === "loading") {
    return <div className="boot" aria-busy="true" />;
  }

  const current =
    view.name === "reader" ? lib.state.data.books.find((b) => b.id === view.bookId) ?? null : null;

  return (
    <I18nProvider locale={locale}>
      {current ? (
        <Reader
          key={current.id}
          book={current}
          lib={lib}
          onBack={() => setView({ name: "library" })}
        />
      ) : (
        <Library lib={lib} onOpen={(bookId) => setView({ name: "reader", bookId })} />
      )}
    </I18nProvider>
  );
}
