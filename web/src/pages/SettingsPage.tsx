import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import type { Settings } from "../api/types";

export function SettingsPage() {
  const { t } = useTranslation();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [loanPeriodDays, setLoanPeriodDays] = useState("");
  const [maxRenewals, setMaxRenewals] = useState("");
  const [holdReadyDays, setHoldReadyDays] = useState("");
  const [defaultBorrowLimit, setDefaultBorrowLimit] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/settings")
      .then((data) => {
        setSettings(data);
        setLoanPeriodDays(String(data.loanPeriodDays));
        setMaxRenewals(String(data.maxRenewals));
        setHoldReadyDays(String(data.holdReadyDays));
        setDefaultBorrowLimit(String(data.defaultBorrowLimit));
      })
      .catch((err) => setLoadError(translateApiError(t, err)));
  }, [t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await api.put<Settings>("/settings", {
        loanPeriodDays: Number(loanPeriodDays),
        maxRenewals: Number(maxRenewals),
        holdReadyDays: Number(holdReadyDays),
        defaultBorrowLimit: Number(defaultBorrowLimit),
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(translateApiError(t, err));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <p className="error-text">{loadError}</p>;
  if (!settings) return <p className="muted">{t("common.loading")}</p>;

  return (
    <div>
      <h1>{t("settings.title")}</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          {t("settings.loanPeriodDays")}
          <input
            type="number"
            required
            min={1}
            max={365}
            value={loanPeriodDays}
            onChange={(e) => setLoanPeriodDays(e.target.value)}
          />
        </label>
        <label>
          {t("settings.maxRenewals")}
          <input
            type="number"
            required
            min={0}
            max={10}
            value={maxRenewals}
            onChange={(e) => setMaxRenewals(e.target.value)}
          />
        </label>
        <label>
          {t("settings.holdReadyDays")}
          <input
            type="number"
            required
            min={1}
            max={365}
            value={holdReadyDays}
            onChange={(e) => setHoldReadyDays(e.target.value)}
          />
        </label>
        <label>
          {t("settings.defaultBorrowLimit")}
          <input
            type="number"
            required
            min={1}
            max={50}
            value={defaultBorrowLimit}
            onChange={(e) => setDefaultBorrowLimit(e.target.value)}
          />
        </label>
        {saveError && <p className="error-text">{saveError}</p>}
        {saved && <p className="success-text">{t("settings.saved")}</p>}
        <button className="primary" type="submit" disabled={saving}>
          {t("settings.save")}
        </button>
      </form>
    </div>
  );
}
