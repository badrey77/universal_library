import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { BookSummary } from "../api/types";

export function CatalogPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookSummary[] | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      const search = query ? `?q=${encodeURIComponent(query)}` : "";
      api
        .get<BookSummary[]>(`/books${search}`)
        .then(setBooks)
        .catch(() => setBooks([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

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
      {books?.length === 0 && <p className="muted">{t("catalog.noResults")}</p>}

      {books?.map((book) => (
        <div className="card" key={book.id}>
          <p className="card-title">
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </p>
          <p className="card-meta">{t("catalog.byAuthor", { author: book.author })}</p>
          <span className={`pill ${book.availableCopies > 0 ? "available" : "unavailable"}`}>
            {t("catalog.available", { count: book.availableCopies, total: book.totalCopies })}
          </span>
        </div>
      ))}
    </div>
  );
}
