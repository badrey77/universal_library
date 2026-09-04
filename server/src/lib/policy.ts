export const LOAN_PERIOD_DAYS = 14;
export const MAX_RENEWALS = 2;
export const HOLD_READY_DAYS = 3;

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
