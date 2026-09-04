import type { TFunction } from "i18next";
import { ApiError } from "./client";

// Maps stable backend error codes to translation keys, so a French/Arabic
// UI never has to render an English message straight from the API.
// Codes without an entry here fall back to the generic common.error text.
const CODE_TO_KEY: Record<string, string> = {
  INVALID_CREDENTIALS: "auth.invalidCredentials",
  EMAIL_TAKEN: "auth.emailTaken",
  HOLD_ALREADY_EXISTS: "catalog.alreadyOnHold",
  COPY_NOT_FOUND: "errors.COPY_NOT_FOUND",
  MEMBER_NOT_FOUND: "errors.MEMBER_NOT_FOUND",
  COPY_RESERVED_FOR_HOLD: "errors.COPY_RESERVED_FOR_HOLD",
  COPY_NOT_AVAILABLE: "errors.COPY_NOT_AVAILABLE",
  BORROW_LIMIT_REACHED: "errors.BORROW_LIMIT_REACHED",
  COPY_STATUS_CONFLICT: "errors.COPY_STATUS_CONFLICT",
  NOT_ON_LOAN: "errors.NOT_ON_LOAN",
  LOAN_NOT_FOUND: "errors.LOAN_NOT_FOUND",
  LOAN_ALREADY_RETURNED: "errors.LOAN_ALREADY_RETURNED",
  FORBIDDEN: "errors.FORBIDDEN",
  RENEWAL_LIMIT_REACHED: "errors.RENEWAL_LIMIT_REACHED",
  HOLD_BLOCKS_RENEWAL: "errors.HOLD_BLOCKS_RENEWAL",
  BOOK_NOT_FOUND: "errors.BOOK_NOT_FOUND",
  HOLD_NOT_FOUND: "errors.HOLD_NOT_FOUND",
  HOLD_ALREADY_FULFILLED: "errors.HOLD_ALREADY_FULFILLED",
  VALIDATION_ERROR: "errors.VALIDATION_ERROR",
  RATE_LIMITED: "errors.RATE_LIMITED",
};

export function translateApiError(t: TFunction, err: unknown): string {
  if (err instanceof ApiError && err.code) {
    const key = CODE_TO_KEY[err.code];
    if (key) return t(key);
  }
  return t("common.error");
}
