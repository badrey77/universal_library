import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";

export function StaffDeskPage() {
  const { t } = useTranslation();

  const [checkoutBarcode, setCheckoutBarcode] = useState("");
  const [memberId, setMemberId] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [returnBarcode, setReturnBarcode] = useState("");
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  async function onCheckout(e: FormEvent) {
    e.preventDefault();
    setCheckoutError(null);
    setCheckoutMessage(null);
    try {
      await api.post("/circulation/checkout", { barcode: checkoutBarcode, memberId });
      setCheckoutMessage(t("staffDesk.success"));
      setCheckoutBarcode("");
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : t("common.error"));
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
      setReturnError(err instanceof ApiError ? err.message : t("common.error"));
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
              <input required value={memberId} onChange={(e) => setMemberId(e.target.value)} />
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
