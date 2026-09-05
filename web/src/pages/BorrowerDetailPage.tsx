import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import type { Hold, Loan, MemberDetail } from "../api/types";

export function BorrowerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [holds, setHolds] = useState<Hold[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    setMember(null);
    setLoans(null);
    setHolds(null);
    api
      .get<MemberDetail>(`/members/${id}`)
      .then(setMember)
      .catch((err) => setError(translateApiError(t, err)));
    api
      .get<Loan[]>(`/members/${id}/loans`)
      .then(setLoans)
      .catch(() => {
        /* surfaced via member load error above */
      });
    api
      .get<Hold[]>(`/members/${id}/holds`)
      .then(setHolds)
      .catch(() => {
        /* surfaced via member load error above */
      });
  }, [id, t]);

  useEffect(load, [load]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(i18n.language);
  }

  if (error) {
    return (
      <div>
        <p className="error-text">{error}</p>
        <Link to="/borrowers">{t("borrowers.backToList")}</Link>
      </div>
    );
  }

  if (!member) {
    return <p className="muted">{t("common.loading")}</p>;
  }

  const now = Date.now();

  return (
    <div>
      <h1>{t("borrowers.detailTitle")}</h1>
      <div className="card">
        <p className="card-title">{member.name}</p>
        <p className="card-meta">{member.email}</p>
        <p className="card-meta">
          {t("borrowers.borrowLimit")}: {member.borrowLimit} ·{" "}
          {t("borrowers.activeLoanCount")}: {member.activeLoanCount}
        </p>
      </div>

      <h2 className="section-heading">{t("borrowers.loansHeading")}</h2>
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
          </div>
        );
      })}

      <h2 className="section-heading">{t("borrowers.holdsHeading")}</h2>
      {holds?.length === 0 && <p className="muted">{t("loans.noHolds")}</p>}
      {holds?.map((hold) => (
        <div className="card" key={hold.id}>
          <p className="card-title">{hold.book.title}</p>
          <p className="card-meta">{t(`loans.holdStatus.${hold.status}`)}</p>
        </div>
      ))}
    </div>
  );
}
