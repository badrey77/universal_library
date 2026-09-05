export type Role = "PATRON" | "STAFF";
export type CopyStatus = "AVAILABLE" | "ON_LOAN" | "ON_HOLD" | "LOST" | "REPAIR";
export type HoldStatus = "WAITING" | "READY" | "FULFILLED" | "EXPIRED" | "CANCELLED";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  borrowLimit: number;
}

export interface BookSummary {
  id: string;
  isbn: string;
  title: string;
  author: string;
  description: string | null;
  totalCopies: number;
  availableCopies: number;
}

export interface Copy {
  id: string;
  barcode: string;
  status: CopyStatus;
}

export interface BookDetail {
  id: string;
  isbn: string;
  title: string;
  author: string;
  description: string | null;
  copies: Copy[];
}

export interface Loan {
  id: string;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewalCount: number;
  copyId: string;
  memberId: string;
  copy: Copy & { book: { id: string; title: string; author: string } };
}

export interface BookHistory {
  totalLoans: number;
  currentlyOnLoan: number;
}

export interface BookHistoryDetailEntry {
  loanId: string;
  memberName: string;
  memberEmail: string;
  copyBarcode: string;
  checkedOutAt: string;
  returnedAt: string | null;
  renewalCount: number;
}

export interface Settings {
  loanPeriodDays: number;
  maxRenewals: number;
  holdReadyDays: number;
  defaultBorrowLimit: number;
}

export interface Hold {
  id: string;
  requestedAt: string;
  status: HoldStatus;
  expiresAt: string | null;
  copyId: string | null;
  bookId: string;
  memberId: string;
  book: { id: string; title: string; author: string };
}
