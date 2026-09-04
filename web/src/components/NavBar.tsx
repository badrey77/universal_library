import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function NavBar() {
  const { t } = useTranslation();
  const { member, logout } = useAuth();

  return (
    <header className="app-header">
      <NavLink to="/" className="brand">
        {t("app.name")}
      </NavLink>
      <nav className="main-nav">
        <NavLink to="/" end>
          {t("nav.catalog")}
        </NavLink>
        {member && <NavLink to="/loans">{t("nav.myLoans")}</NavLink>}
        {member?.role === "STAFF" && <NavLink to="/desk">{t("nav.staffDesk")}</NavLink>}
        {member ? (
          <button type="button" className="link" onClick={logout}>
            {t("nav.logout")} ({member.name})
          </button>
        ) : (
          <>
            <NavLink to="/login">{t("nav.login")}</NavLink>
            <NavLink to="/register">{t("nav.register")}</NavLink>
          </>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
