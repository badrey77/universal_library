import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import { useAuth } from "../context/AuthContext";
import type { BookSummary } from "../api/types";

const COVER_PALETTE = ["#7a4b2a", "#5a6b47", "#3d5a6c", "#8a4a5e", "#6b5a8a"];

function coverColor(isbn: string): string {
  let hash = 0;
  for (let i = 0; i < isbn.length; i++) hash = (hash * 31 + isbn.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[hash % COVER_PALETTE.length];
}

function snippet(text: string, maxLength = 110): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

type HoldState = { status: "loading" | "placed" | "error"; message?: string };

export function CatalogPage() {
  const { t } = useTranslation();
  const { member } = useAuth();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [holdState, setHoldState] = useState<Record<string, HoldState>>({});

  useEffect(() => {
    const handle = setTimeout(() => {
      const search = query ? `?q=${encodeURIComponent(query)}` : "";
      setError(false);
      api
        .get<BookSummary[]>(`/books${search}`)
        .then(setBooks)
        .catch(() => {
          setBooks([]);
          setError(true);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function placeHold(bookId: string) {
    setHoldState((prev) => ({ ...prev, [bookId]: { status: "loading" } }));
    try {
      await api.post("/holds", { bookId });
      setHoldState((prev) => ({
        ...prev,
        [bookId]: { status: "placed", message: t("catalog.holdPlaced") },
      }));
    } catch (err) {
      setHoldState((prev) => ({
        ...prev,
        [bookId]: { status: "error", message: translateApiError(t, err) },
      }));
    }
  }

  return (
    <div>
      <h1>{t("catalog.title")}</h1>
      <input
        className="search-input"
        placeholder={t("catalog.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {books === null && <p className="muted">{t("common.loading")}</p>}
      {books?.length === 0 && (
        <p className={error ? "error-text" : "muted"}>
          {error ? t("common.error") : t("catalog.noResults")}
        </p>
      )}

      {books?.map((book) => {
        const hold = holdState[book.id];
        return (
          <div className="card catalog-card" key={book.id}>
            <div className="book-cover" style={{ background: coverColor(book.isbn) }} aria-hidden="true">
              {book.title.trim().charAt(0).toUpperCase()}
            </div>
            <div className="catalog-card-body">
              <p className="card-title">
                <Link to={`/books/${book.id}`}>{book.title}</Link>
              </p>
              <p className="card-meta">{t("catalog.byAuthor", { author: book.author })}</p>
              {book.description && <p className="card-description">{snippet(book.description)}</p>}
              <div className="catalog-card-actions">
                <span className={`pill ${book.availableCopies > 0 ? "available" : "unavailable"}`}>
                  {t("catalog.available", { count: book.availableCopies, total: book.totalCopies })}
                </span>
                {member?.role === "PATRON" && hold?.status !== "placed" && (
                  <button
                    className="secondary"
                    disabled={hold?.status === "loading"}
                    onClick={() => placeHold(book.id)}
                  >
                    {t("catalog.placeHold")}
                  </button>
                )}
              </div>
              {hold?.message && (
                <p className={hold.status === "error" ? "error-text" : "success-text"}>
                  {hold.message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
