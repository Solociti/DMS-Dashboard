import { useCallback, useEffect, useState } from "react";

import type { OpenSummaryPage } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import MessageDetails from "./MessageDetails";
import MessageFilters, { type MessageFilterValues } from "./MessageFilters";
import MessageTable from "./MessageTable";
import StatCards from "./StatCards";
import { getMessageFilters, saveMessageFilters } from "./messageFiltersStore";

/**
 * Overview page: tracking totals, the message list and open events for the selected message.
 */
export default function OverviewPage() {
  const [result, setResult] = useState<OpenSummaryPage | null>(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [filters, setFilters] = useState(() => getMessageFilters());

  const handleFiltersChange = (next: MessageFilterValues) => {
    setFilters(next);
    setPage(1);
  };

  useEffect(() => {
    // store in local storage
    saveMessageFilters({
      ...filters,
      query: "",
    });
  }, [filters]);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      q: filters.query,
      scope: filters.scope,
      sort: filters.sort,
      dir: filters.direction,
      page: String(page),
    });

    fetchJson<OpenSummaryPage>(`/api/opens?${params}`)
      .then((next) => {
        setResult(next);
        setError(null);
        setSelectedId((current) =>
          current && next.items.some((row) => row.msgId === current)
            ? current
            : (next.items[0]?.msgId ?? null),
        );
        setVersion((value) => value + 1);
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  }, [filters, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <section className="stack">
      <StatCards
        totalMessages={result?.total ?? 0}
        totalOpens={result?.totalOpens ?? 0}
        lastActivity={result?.items[0]?.lastOpened ?? null}
      />

      <MessageFilters filters={filters} onChange={handleFiltersChange} />

      <div className="content-grid">
        <MessageTable
          rows={result?.items ?? null}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={load}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          page={page}
          pageSize={result?.pageSize ?? 50}
          total={result?.total ?? 0}
          onPageChange={setPage}
        />

        <MessageDetails
          msgId={selectedId}
          version={version}
          loadFailed={error !== null}
        />
      </div>
    </section>
  );
}
