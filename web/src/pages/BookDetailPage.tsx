import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { BookDetail } from "../api/types";
import { useAuth } from "../context/AuthContext";

export function BookDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { member } = useAuth();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [holdMessage, setHoldMessage] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<BookDetail>(`/books/${id}`).then(setBook);
  }, [id]);

  async function placeHold() {
    if (!id) return;
    setHoldError(null);
    setHoldMessage(null);
    try {
      await api.post("/holds", { bookId: id });
      setHoldMessage(t("catalog.holdPlaced"));
    } catch (err) {
      setHoldError(
        err instanceof ApiError && err.status === 409 ? t("catalog.alreadyOnHold") : t("common.error")
      );
    }
  }

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
          <span className={`pill status-${copy.status}`}>{copy.status}</span>
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
    </div>
  );
}
