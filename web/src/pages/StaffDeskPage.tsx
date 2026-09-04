import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { translateApiError } from "../api/errorMessages";
import type { Member } from "../api/types";

function MemberPicker({ onChange }: { onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLabel || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api
        .get<Member[]>(`/members?q=${encodeURIComponent(query)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selectedLabel]);

  function pick(member: Member) {
    setSelectedLabel(`${member.name} (${member.email})`);
    setQuery(`${member.name} (${member.email})`);
    setResults([]);
    onChange(member.id);
  }

  function onInputChange(value: string) {
    setQuery(value);
    if (selectedLabel) {
      setSelectedLabel(null);
      onChange("");
    }
  }

  return (
    <div>
      <input
        required
        value={query}
        placeholder={t("staffDesk.memberSearchPlaceholder")}
        onChange={(e) => onInputChange(e.target.value)}
      />
      {!selectedLabel && query.trim().length >= 2 && (
        <ul className="member-results">
          {results.length === 0 && <li className="muted">{t("staffDesk.memberNoResults")}</li>}
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => pick(m)}>
                {m.name} — {m.email}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StaffDeskPage() {
  const { t } = useTranslation();

  const [checkoutBarcode, setCheckoutBarcode] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberPickerKey, setMemberPickerKey] = useState(0);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [returnBarcode, setReturnBarcode] = useState("");
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  async function onCheckout(e: FormEvent) {
    e.preventDefault();
    setCheckoutError(null);
    setCheckoutMessage(null);
    if (!memberId) {
      setCheckoutError(t("staffDesk.memberNoResults"));
      return;
    }
    try {
      await api.post("/circulation/checkout", { barcode: checkoutBarcode, memberId });
      setCheckoutMessage(t("staffDesk.success"));
      setCheckoutBarcode("");
      setMemberId("");
      setMemberPickerKey((k) => k + 1);
    } catch (err) {
      setCheckoutError(translateApiError(t, err));
    }
  }

  async function onReturn(e: FormEvent) {
    e.preventDefault();
    setReturnError(null);
    setReturnMessage(null);
    try {
      const result = await api.post<{ copyStatus: string; reservedForMemberId: string | null }>(
        "/circulation/return",
        { barcode: returnBarcode }
      );
      setReturnMessage(
        result.reservedForMemberId
          ? t("staffDesk.copyReserved", { memberId: result.reservedForMemberId })
          : t("staffDesk.success")
      );
      setReturnBarcode("");
    } catch (err) {
      setReturnError(translateApiError(t, err));
    }
  }

  return (
    <div>
      <h1>{t("staffDesk.title")}</h1>
      <div className="desk-grid">
        <div>
          <h2 className="section-heading">{t("staffDesk.checkoutHeading")}</h2>
          <form className="stack" onSubmit={onCheckout}>
            <label>
              {t("staffDesk.barcode")}
              <input
                required
                value={checkoutBarcode}
                onChange={(e) => setCheckoutBarcode(e.target.value)}
              />
            </label>
            <label>
              {t("staffDesk.memberId")}
              <MemberPicker key={memberPickerKey} onChange={setMemberId} />
            </label>
            {checkoutError && <p className="error-text">{checkoutError}</p>}
            {checkoutMessage && <p className="success-text">{checkoutMessage}</p>}
            <button className="primary" type="submit">
              {t("staffDesk.checkout")}
            </button>
          </form>
        </div>

        <div>
          <h2 className="section-heading">{t("staffDesk.returnHeading")}</h2>
          <form className="stack" onSubmit={onReturn}>
            <label>
              {t("staffDesk.barcode")}
              <input
                required
                value={returnBarcode}
                onChange={(e) => setReturnBarcode(e.target.value)}
              />
            </label>
            {returnError && <p className="error-text">{returnError}</p>}
            {returnMessage && <p className="success-text">{returnMessage}</p>}
            <button className="primary" type="submit">
              {t("staffDesk.return")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
