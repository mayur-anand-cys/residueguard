import { useEffect, useMemo, useState, type ReactNode } from "react";
import { documentLocale, LANGUAGE_STORAGE_KEY, parseLanguage, translate, type Lang } from "./translate";
import type { MessageKey } from "./translations";
import { LanguageContext, type LanguageContextValue } from "./useTranslation";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      setLangState(parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)));
    } catch {
      setLangState("en");
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = documentLocale(lang);
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      lang,
      setLang: (next) => {
        setLangState(next);
        try {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        } catch {
          /* preference stays in memory for this view */
        }
      },
      t: (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
