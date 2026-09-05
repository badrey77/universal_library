import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";

export function AddBookPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [theme, setTheme] = useState("");
  const [initialCopies, setInitialCopies] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const book = await api.post<{ id: string }>("/books", {
        isbn,
        title,
        author,
        description: description || undefined,
        category: category || undefined,
        theme: theme || undefined,
        initialCopies,
      });
      navigate(`/books/${book.id}`);
    } catch (err) {
      setError(translateApiError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>{t("addBook.title")}</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          {t("addBook.isbn")}
          <input required value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        </label>
        <label>
          {t("addBook.bookTitle")}
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          {t("addBook.author")}
          <input required value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <label>
          {t("addBook.description")}
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          {t("addBook.category")}
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label>
          {t("addBook.theme")}
          <input value={theme} onChange={(e) => setTheme(e.target.value)} />
        </label>
        <label>
          {t("addBook.initialCopies")}
          <input
            type="number"
            min={0}
            max={50}
            required
            value={initialCopies}
            onChange={(e) => setInitialCopies(Number(e.target.value))}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {t("addBook.submit")}
        </button>
      </form>
    </div>
  );
}
