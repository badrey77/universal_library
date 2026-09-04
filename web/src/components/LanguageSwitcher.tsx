import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";

const LABELS: Record<string, string> = {
  en: "EN",
  fr: "FR",
  ar: "AR",
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? "en";

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          className={lng === current ? "active" : ""}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {LABELS[lng]}
        </button>
      ))}
    </div>
  );
}
