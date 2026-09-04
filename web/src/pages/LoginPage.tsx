import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? t("auth.invalidCredentials") : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>{t("auth.loginTitle")}</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          {t("auth.email")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t("auth.password")}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {t("auth.loginSubmit")}
        </button>
      </form>
      <p className="muted">
        {t("auth.noAccount")} <Link to="/register">{t("nav.register")}</Link>
      </p>
    </div>
  );
}
