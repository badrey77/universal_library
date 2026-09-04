import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import type { Hold, Loan } from "../api/types";

export function MyLoansPage() {
  const { t, i18n } = useTranslation();
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [holds, setHolds] = useState<Hold[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    api
      .get<Loan[]>("/members/me/loans")
      .then(setLoans)
      .catch(() => setLoadError(true));
    api
      .get<Hold[]>("/members/me/holds")
      .then(setHolds)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(load, [load]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(i18n.language);
  }

  async function renew(loanId: string) {
    setBusyId(loanId);
    setActionError(null);
    setActionMessage(null);
    try {
      const updated = await api.post<Loan>(`/circulation/renew`, { loanId });
      setActionMessage(t("loans.renewed", { date: formatDate(updated.dueAt) }));
      load();
    } catch (err) {
      setActionError(translateApiError(t, err));
    } finally {
      setBusyId(null);
    }
  }

  async function cancelHold(holdId: string) {
    setBusyId(holdId);
    setActionError(null);
    setActionMessage(null);
    try {
      await api.del(`/holds/${holdId}`);
      load();
    } catch (err) {
      setActionError(translateApiError(t, err));
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();

  return (
    <div>
      <h1>{t("loans.title")}</h1>
      {loadError && <p className="error-text">{t("common.error")}</p>}
      {actionError && <p className="error-text">{actionError}</p>}
      {actionMessage && <p className="muted">{actionMessage}</p>}

      <h2 className="section-heading">{t("loans.loansHeading")}</h2>
      {loans?.length === 0 && <p className="muted">{t("loans.noLoans")}</p>}
      {loans?.map((loan) => {
        const overdue = !loan.returnedAt && new Date(loan.dueAt).getTime() < now;
        return (
          <div className="card" key={loan.id}>
            <p className="card-title">{loan.copy.book.title}</p>
            <p className="card-meta">
              {loan.returnedAt
                ? t("loans.returned", { date: formatDate(loan.returnedAt) })
                : t("loans.dueOn", { date: formatDate(loan.dueAt) })}
              {overdue && <span className="error-text"> · {t("loans.overdue")}</span>}
            </p>
            {!loan.returnedAt && (
              <button
                className="secondary"
                disabled={busyId === loan.id}
                onClick={() => renew(loan.id)}
              >
                {t("loans.renew")}
              </button>
            )}
          </div>
        );
      })}

      <h2 className="section-heading">{t("loans.holdsHeading")}</h2>
      {holds?.length === 0 && <p className="muted">{t("loans.noHolds")}</p>}
      {holds?.map((hold) => (
        <div className="card" key={hold.id}>
          <p className="card-title">{hold.book.title}</p>
          <p className="card-meta">{t(`loans.holdStatus.${hold.status}`)}</p>
          {(hold.status === "WAITING" || hold.status === "READY") && (
            <button
              className="secondary"
              disabled={busyId === hold.id}
              onClick={() => cancelHold(hold.id)}
            >
              {t("loans.cancelHold")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
