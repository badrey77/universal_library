import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { Hold, Loan } from "../api/types";

export function MyLoansPage() {
  const { t, i18n } = useTranslation();
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [holds, setHolds] = useState<Hold[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Loan[]>("/members/me/loans").then(setLoans);
    api.get<Hold[]>("/members/me/holds").then(setHolds);
  }, []);

  useEffect(load, [load]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(i18n.language);
  }

  async function renew(loanId: string) {
    setBusyId(loanId);
    try {
      await api.post(`/circulation/renew`, { loanId });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function cancelHold(holdId: string) {
    setBusyId(holdId);
    try {
      await api.del(`/holds/${holdId}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();

  return (
    <div>
      <h1>{t("loans.title")}</h1>

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
