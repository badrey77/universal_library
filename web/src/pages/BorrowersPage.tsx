import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Member } from "../api/types";

export function BorrowersPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[] | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      api
        .get<Member[]>(`/members?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div>
      <h1>{t("borrowers.title")}</h1>
      <div className="toolbar-row">
        <input
          className="search-input"
          value={query}
          placeholder={t("borrowers.searchPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Link className="primary" to="/borrowers/new">
          {t("borrowers.addBorrower")}
        </Link>
      </div>

      {results?.length === 0 && <p className="muted">{t("borrowers.noResults")}</p>}
      {results?.map((member) => (
        <div className="card" key={member.id}>
          <p className="card-title">
            <Link to={`/borrowers/${member.id}`}>{member.name}</Link>
          </p>
          <p className="card-meta">{member.email}</p>
        </div>
      ))}
    </div>
  );
}
