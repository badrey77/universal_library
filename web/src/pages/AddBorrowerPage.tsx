import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import type { MemberDetail } from "../api/types";

export function AddBorrowerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [borrowLimit, setBorrowLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: { name: string; email: string; password: string; borrowLimit?: number } = {
        name,
        email,
        password,
      };
      if (borrowLimit.trim() !== "") {
        body.borrowLimit = Number(borrowLimit);
      }
      const member = await api.post<MemberDetail>("/members", body);
      navigate(`/borrowers/${member.id}`);
    } catch (err) {
      setError(translateApiError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>{t("borrowers.addTitle")}</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          {t("auth.name")}
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t("auth.email")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t("auth.password")}
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="muted">{t("auth.passwordHint")}</span>
        </label>
        <label>
          {t("borrowers.borrowLimitOverride")}
          <input
            type="number"
            min={1}
            step={1}
            value={borrowLimit}
            onChange={(e) => setBorrowLimit(e.target.value)}
          />
          <span className="muted">{t("borrowers.borrowLimitHint")}</span>
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {t("borrowers.createSubmit")}
        </button>
      </form>
    </div>
  );
}
