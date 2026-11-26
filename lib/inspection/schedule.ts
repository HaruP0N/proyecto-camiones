/** Agenda is selected by Chilean calendar day; a same-day inspection is valid. */
export function normalizeSchedule(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, hh = "09", mm = "00", ss = "00"] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d || +hh > 23 || +mm > 59 || +ss > 59) return null;
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}
