// SQLite timestamps are UTC but have no zone suffix; without one, Date parses them as local time.
const sqliteTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

export function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(
    sqliteTimestamp.test(value) ? `${value.replace(" ", "T")}Z` : value,
  );

  if (!Number.isFinite(date.getTime())) {
    return "Invalid date";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const partValue = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${partValue("month")} ${partValue("day")} ${partValue("year")} ${partValue("hour")}:${partValue("minute")} ${partValue("dayPeriod")}`;
}
