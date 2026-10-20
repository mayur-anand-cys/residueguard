import { createContext, useContext } from "react";
import type { Lang } from "./translate";
import type { MessageKey } from "./translations";

export interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useTranslation(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useTranslation must be used within LanguageProvider.");
  }
  return value;
}

export function labelClass(lang: Lang): string {
  const tracking = lang === "en" ? "uppercase tracking-wider" : "tracking-normal";
  return `text-xs font-semibold leading-snug ${tracking} text-slate-500`;
}
