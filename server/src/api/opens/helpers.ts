import type {
  OpenScope,
  OpenSortField,
  SortDirection,
} from "../../../../common/types";

export const OPEN_PAGE_SIZE = 50;

export interface OpenFilters {
  query: string;
  scope: OpenScope;
  sort: OpenSortField;
  direction: SortDirection;
  page: number;
}

export function getOpenRouteParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function firstString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseOpenFilters(query: Record<string, unknown>): OpenFilters {
  return {
    query: firstString(query.q).trim().slice(0, 200),
    scope: firstString(query.scope) === "mine" ? "mine" : "all",
    sort: firstString(query.sort) === "sent" ? "sent" : "opened",
    direction: firstString(query.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.floor(Number(firstString(query.page))) || 1),
  };
}