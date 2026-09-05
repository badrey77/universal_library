// Loan period / renewal / hold policy values used to live here as hardcoded
// constants; they're now admin-editable and persisted via the Setting
// singleton (see ../lib/settings.ts). addDays remains here as the one pure
// helper still shared by callers of that data.
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
