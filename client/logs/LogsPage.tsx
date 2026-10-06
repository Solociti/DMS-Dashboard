import { useCallback, useEffect, useState } from "react";

import type { LogFileInfo, LogFileResponse } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import { useInterval } from "../shared/useInterval";
import LogContent from "./LogContent";
import LogList from "./LogList";

const POLL_INTERVAL_MS = 10000;

/**
 * Logs page: mounted log files and the tail of the selected one, refreshed every 10 seconds while mounted.
 */
export default function LogsPage() {
  const [logs, setLogs] = useState<LogFileInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<LogFileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback((name: string) => {
    fetchJson<LogFileResponse>(
      `/api/logs/${encodeURIComponent(name)}?lines=200`,
    )
      .then((next) => {
        setContent(next);
        setError(null);
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  }, []);

  const loadLogs = () => {
    fetchJson<LogFileInfo[]>("/api/logs")
      .then((next) => {
        const name = next.some((log) => log.name === selected)
          ? selected
          : (next[0]?.name ?? null);

        setLogs(next);
        setSelected(name);

        if (name) {
          loadContent(name);
        } else {
          setContent(null);
        }
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  };

  useEffect(loadLogs, []);

  useInterval(loadLogs, POLL_INTERVAL_MS);

  const handleSelect = (name: string) => {
    setSelected(name);
    loadContent(name);
  };

  return (
    <section className="stack">
      <div className="content-grid logs-grid">
        <LogList
          logs={logs}
          selected={selected}
          onSelect={handleSelect}
          onRefresh={loadLogs}
        />

        <LogContent
          content={content}
          error={error}
          empty={logs?.length === 0}
          onTail={() => selected && loadContent(selected)}
        />
      </div>
    </section>
  );
}
