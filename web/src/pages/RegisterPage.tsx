import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409 ? t("auth.emailTaken") : t("common.error")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>{t("auth.registerTitle")}</h1>
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {t("auth.registerSubmit")}
        </button>
      </form>
      <p className="muted">
        {t("auth.haveAccount")} <Link to="/login">{t("nav.login")}</Link>
      </p>
    </div>
  );
}
