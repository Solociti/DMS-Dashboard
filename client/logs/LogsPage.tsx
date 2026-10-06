import { useEffect, useState } from "react";
import type { LogFileInfo } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import LogContent from "./LogContent";
import LogList from "./LogList";

/**
 * Logs page: mounted log files and the tail of the selected one, refreshed every 10 seconds while mounted.
 */
export default function LogsPage() {
  const [logs, setLogs] = useState<LogFileInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = () => {
    fetchJson<LogFileInfo[]>("/api/logs")
      .then((next) => {
        const name = next.some((log) => log.name === selected)
          ? selected
          : (next[0]?.name ?? null);

        setLogs(next);

        if (next.length === 0) {
          setError(
            "Configure LOG_FILES or mount DMS logs to inspect them here.",
          );
        } else {
          setError(null);
        }

        setSelected(name);
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  };

  useEffect(loadLogs, []);

  return (
    <section className="stack">
      <div className="content-grid logs-grid">
        <LogList
          logs={logs}
          selected={selected}
          onSelect={setSelected}
          onRefresh={loadLogs}
        />

        <LogContent selected={selected} error={error} />
      </div>
    </section>
  );
}
