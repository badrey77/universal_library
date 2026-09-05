import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
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

type ViewMode = "all" | "newest" | "category" | "theme";

export function CatalogPage() {
  const { t } = useTranslation();
  const { member } = useAuth();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");

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

  // Groups (or a flat, possibly reordered list) derived from the fetched
  // books based on the selected view mode. The server always returns books
  // ordered alphabetically by title -- everything below is a client-side
  // reorder/regroup of that same list, so switching modes never re-fetches.
  const groups = useMemo(() => {
    if (!books) return null;

    if (viewMode === "newest") {
      const sorted = [...books].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return [{ heading: null as string | null, books: sorted }];
    }

    if (viewMode === "category" || viewMode === "theme") {
      const key = viewMode === "category" ? "category" : "theme";
      const fallbackLabel = viewMode === "category" ? t("catalog.uncategorized") : t("catalog.noTheme");

      const buckets = new Map<string, BookSummary[]>();
      for (const book of books) {
        const value = book[key];
        const bucketKey = value ?? "";
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
        buckets.get(bucketKey)!.push(book);
      }

      const namedKeys = [...buckets.keys()].filter((k) => k !== "").sort((a, b) => a.localeCompare(b));
      const result = namedKeys.map((k) => ({ heading: k as string | null, books: buckets.get(k)! }));
      if (buckets.has("")) {
        result.push({ heading: fallbackLabel, books: buckets.get("")! });
      }
      return result;
    }

    // "all": server-ordered alphabetically by title, unchanged.
    return [{ heading: null as string | null, books }];
  }, [books, viewMode, t]);

  function renderCard(book: BookSummary) {
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
          <span className={`pill ${book.availableCopies > 0 ? "available" : "unavailable"}`}>
            {t("catalog.available", { count: book.availableCopies, total: book.totalCopies })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{t("catalog.title")}</h1>
      <div className="toolbar-row">
        <input
          className="search-input"
          placeholder={t("catalog.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {member?.role === "STAFF" && (
          <Link className="primary" to="/books/new">
            {t("addBook.title")}
          </Link>
        )}
      </div>

      <label className="view-mode-picker">
        {t("catalog.viewMode.label")}
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
          <option value="all">{t("catalog.viewMode.all")}</option>
          <option value="newest">{t("catalog.viewMode.newest")}</option>
          <option value="category">{t("catalog.viewMode.byCategory")}</option>
          <option value="theme">{t("catalog.viewMode.byTheme")}</option>
        </select>
      </label>

      {books === null && <p className="muted">{t("common.loading")}</p>}
      {books?.length === 0 && (
        <p className={error ? "error-text" : "muted"}>
          {error ? t("common.error") : t("catalog.noResults")}
        </p>
      )}

      {groups?.map((group, i) => (
        <div key={group.heading ?? `flat-${i}`}>
          {group.heading !== null && <h2 className="section-heading">{group.heading}</h2>}
          {group.books.map(renderCard)}
        </div>
      ))}
    </div>
  );
}
