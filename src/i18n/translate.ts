import { en, hi, kn, type MessageKey } from "./translations";

export type Lang = "en" | "kn" | "hi";

export const LANGS: Lang[] = ["en", "kn", "hi"];

export const LANGUAGE_STORAGE_KEY = "residueguard.lang";

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, kn, hi };

export function parseLanguage(value: string | null | undefined): Lang {
  if (value === "kn" || value === "hi" || value === "en") return value;
  return "en";
}

/** English when a translation is missing. Never returns the raw key. */
export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const localized = DICTS[lang]?.[key];
  const template = localized || en[key] || "";
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value === undefined ? "" : String(value);
  });
}

export function documentLocale(lang: Lang): string {
  if (lang === "kn") return "kn";
  if (lang === "hi") return "hi";
  return "en";
}

/** Display-only. Stored audit timestamps stay UTC ISO and are what the hash covers. */
export function formatUtcTimestamp(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = lang === "kn" ? "kn-IN" : lang === "hi" ? "hi-IN" : "en-GB";
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
  return `${formatted} UTC`;
}
