import { useCallback, useEffect, useState } from "react";

import type { OpenSummary } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import MessageDetails from "./MessageDetails";
import MessageTable from "./MessageTable";
import StatCards from "./StatCards";

/**
 * Overview page: tracking totals, the message list and open events for the selected message.
 */
export default function OverviewPage() {
  const [rows, setRows] = useState<OpenSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    fetchJson<OpenSummary[]>("/api/opens")
      .then((next) => {
        setRows(next);
        setError(null);
        setSelectedId((current) =>
          current && next.some((row) => row.msgId === current)
            ? current
            : (next[0]?.msgId ?? null),
        );
        setVersion((value) => value + 1);
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="stack">
      <StatCards rows={rows ?? []} />

      <div className="content-grid">
        <MessageTable
          rows={rows}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={load}
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
