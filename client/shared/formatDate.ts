export function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

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
