// Every date the UI shows is UTC and built by slicing ISO strings, so the
// server and the browser render the same text. `toLocaleString()` would differ
// by locale and timezone and cause a hydration mismatch.

/** "2026-10-20T09:30:00.000Z" -> "2026-10-20 09:30 UTC" */
export function formatUtc(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

/** "2026-10-20T09:30:00.000Z" -> "09:30" */
export function formatUtcTime(iso: string): string {
  return iso.slice(11, 16);
}

/** "09:30 to 10:00 UTC", with the end day added when it differs. */
export function formatUtcRange(startIso: string, endIso: string): string {
  const sameDay = startIso.slice(0, 10) === endIso.slice(0, 10);
  const end = sameDay ? formatUtcTime(endIso) : formatUtc(endIso);
  return `${formatUtcTime(startIso)} to ${sameDay ? `${end} UTC` : end}`;
}

/** Today's date in UTC, YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** ("2026-10-20", "09:30") -> "2026-10-20T09:30:00.000Z" */
export function isoFromDayAndTime(day: string, time: string): string {
  return new Date(`${day}T${time}:00.000Z`).toISOString();
}
