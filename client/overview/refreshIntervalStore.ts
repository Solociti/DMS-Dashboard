export const refreshIntervalOptions = [
  { label: "30 seconds", ms: 30_000 },
  { label: "1 minute", ms: 60_000 },
  { label: "2 minutes", ms: 120_000 },
  { label: "5 minutes", ms: 300_000 },
  { label: "10 minutes", ms: 600_000 },
  { label: "15 minutes", ms: 900_000 },
  { label: "30 minutes", ms: 1_800_000 },
];

export const defaultRefreshIntervalMs = 600_000;

const storageKey = "overview-refresh-interval";

export function saveRefreshInterval(ms: number): void {
  localStorage.setItem(storageKey, String(ms));
}

export function getRefreshInterval(): number {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    if (refreshIntervalOptions.some((option) => option.ms === stored)) {
      return stored;
    }
  } catch {
    // ignore errors.
  }

  return defaultRefreshIntervalMs;
}
