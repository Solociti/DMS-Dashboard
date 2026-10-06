import { MessageFilterValues } from "./MessageFilters";

export const defaultFilters: MessageFilterValues = {
  query: "",
  scope: "mine",
  sort: "opened",
  direction: "desc",
};

/**
 * Save the given message filters to local storage.
 *
 * @param filters
 */
export function saveMessageFilters(filters: MessageFilterValues) {
  localStorage.setItem("message-filters", JSON.stringify(filters));
}

/**
 * Get the stored message filters from local storage, or return the default filters if none are stored or an error occurs.
 *
 * @returns
 */
export function getMessageFilters(): MessageFilterValues {
  try {
    const stored = localStorage.getItem("message-filters");
    if (stored) {
      const parsed = JSON.parse(stored);
      return Object.assign({}, defaultFilters, parsed);
    }
  } catch {
    // ignore errors.
  }

  return Object.assign({}, defaultFilters);
}
