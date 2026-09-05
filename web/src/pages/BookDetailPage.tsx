import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import type { BookDetail, BookHistory, BookHistoryDetailEntry } from "../api/types";
import { useAuth } from "../context/AuthContext";

export function BookDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { member } = useAuth();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [holdMessage, setHoldMessage] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [history, setHistory] = useState<BookHistory | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<BookHistoryDetailEntry[] | null>(null);
  const [historyDetailError, setHistoryDetailError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadError(false);
    api
      .get<BookDetail>(`/books/${id}`)
      .then(setBook)
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setHistoryError(false);
    api
      .get<BookHistory>(`/books/${id}/history`)
      .then(setHistory)
      .catch(() => setHistoryError(true));
  }, [id]);

  useEffect(() => {
    if (!id || member?.role !== "STAFF") return;
    setHistoryDetailError(false);
    api
      .get<BookHistoryDetailEntry[]>(`/books/${id}/history/detail`)
      .then(setHistoryDetail)
      .catch(() => setHistoryDetailError(true));
  }, [id, member?.role]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(i18n.language);
  }

  async function placeHold() {
    if (!id) return;
    setHoldError(null);
    setHoldMessage(null);
    try {
      await api.post("/holds", { bookId: id });
      setHoldMessage(t("catalog.holdPlaced"));
    } catch (err) {
      setHoldError(translateApiError(t, err));
    }
  }

  if (loadError) return <p className="error-text">{t("common.error")}</p>;
  if (!book) return <p className="muted">{t("common.loading")}</p>;

  const availableCount = book.copies.filter((c) => c.status === "AVAILABLE").length;

  return (
    <div>
      <h1>{book.title}</h1>
      <p className="card-meta">{t("catalog.byAuthor", { author: book.author })}</p>
      {book.description && <p>{book.description}</p>}

      <h2 className="section-heading">{t("catalog.available", { count: availableCount, total: book.copies.length })}</h2>
      {book.copies.map((copy) => (
        <div className="card" key={copy.id}>
          <code>{copy.barcode}</code>{" "}
          <span className={`pill status-${copy.status}`}>
            {t(`catalog.copyStatus.${copy.status}`)}
          </span>
        </div>
      ))}

      {member?.role === "PATRON" && (
        <>
          <button className="primary" onClick={placeHold} style={{ marginTop: "1rem" }}>
            {t("catalog.placeHold")}
          </button>
          {holdMessage && <p className="success-text">{holdMessage}</p>}
          {holdError && <p className="error-text">{holdError}</p>}
        </>
      )}

      <h2 className="section-heading">{t("catalog.history.heading")}</h2>
      {historyError && <p className="error-text">{t("common.error")}</p>}
      {!historyError && !history && <p className="muted">{t("common.loading")}</p>}
      {history &&
        (history.totalLoans === 0 ? (
          <p className="muted">{t("catalog.history.neverBorrowed")}</p>
        ) : (
          <>
            <p>{t("catalog.history.borrowedCount", { count: history.totalLoans })}</p>
            <p>{t("catalog.history.currentlyOnLoan", { count: history.currentlyOnLoan })}</p>
          </>
        ))}

      {member?.role === "STAFF" && (
        <>
          <h2 className="section-heading">{t("catalog.history.detailHeading")}</h2>
          {historyDetailError && <p className="error-text">{t("common.error")}</p>}
          {!historyDetailError && !historyDetail && <p className="muted">{t("common.loading")}</p>}
          {historyDetail && historyDetail.length === 0 && (
            <p className="muted">{t("catalog.history.neverBorrowed")}</p>
          )}
          {historyDetail && historyDetail.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>{t("catalog.history.columnMember")}</th>
                  <th>{t("catalog.history.columnCheckedOut")}</th>
                  <th>{t("catalog.history.columnReturned")}</th>
                  <th>{t("catalog.history.columnRenewals")}</th>
                </tr>
              </thead>
              <tbody>
                {historyDetail.map((entry) => (
                  <tr key={entry.loanId}>
                    <td>
                      {entry.memberName} <span className="muted">({entry.memberEmail})</span>
                    </td>
                    <td>{formatDate(entry.checkedOutAt)}</td>
                    <td>
                      {entry.returnedAt
                        ? formatDate(entry.returnedAt)
                        : t("catalog.history.stillOnLoan")}
                    </td>
                    <td>{entry.renewalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
