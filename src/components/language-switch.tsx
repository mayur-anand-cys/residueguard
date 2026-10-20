import { useTranslation } from "@/i18n/useTranslation";
import type { Lang } from "@/i18n/translate";

const OPTIONS: { code: Lang; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "kn", label: "ಕನ್ನಡ", name: "ಕನ್ನಡ" },
  { code: "hi", label: "हिंदी", name: "हिंदी" },
];

export function LanguageSwitch() {
  const { lang, setLang, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("lang.group")}
      className="flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
    >
      {OPTIONS.map((option) => {
        const selected = lang === option.code;
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            aria-pressed={selected}
            aria-label={option.name}
            onClick={() => setLang(option.code)}
            className={
              "min-h-11 rounded-md px-2.5 text-sm font-semibold leading-snug " +
              (selected ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-white")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
