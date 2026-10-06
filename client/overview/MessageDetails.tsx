import { useEffect, useState } from "react";

import type { OpenLogEntry } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { formatDate } from "../shared/formatDate";
import { getErrorMessage } from "../shared/getErrorMessage";

interface MessageDetailsProps {
  /**
   * Selected message id, or null when nothing is selected.
   */
  msgId: string | null;

  /**
   * Changes whenever the parent refreshed, forcing a reload.
   */
  version: number;

  /**
   * True when the overview itself failed to load.
   */
  loadFailed: boolean;
}

/**
 * Open events for the selected message.
 *
 * @param {MessageDetailsProps} arg0 [!important, fetches its own data keyed on msgId and version]
 */
export default function MessageDetails({
  msgId,
  version,
  loadFailed,
}: MessageDetailsProps) {
  const [entries, setEntries] = useState<OpenLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!msgId) {
      setEntries([]);
      return;
    }

    let cancelled = false;

    fetchJson<OpenLogEntry[]>(`/api/opens/${encodeURIComponent(msgId)}`)
      .then((next) => {
        if (!cancelled) {
          setEntries(next);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [msgId, version]);

  const title = loadFailed
    ? "Overview failed to load"
    : msgId
      ? `${msgId} • ${entries.length} open${entries.length === 1 ? "" : "s"}`
      : "Select a message to inspect open events.";

  return (
    <section className="panel inset">
      <div className="panel-heading">
        <h2>Open Details</h2>
        <p>{title}</p>
      </div>

      <ul className="details-list">
        {error ? <li>{error}</li> : null}
        {!error && !msgId ? <li>No message selected.</li> : null}
        {!error && msgId && entries.length === 0 ? (
          <li>No open events recorded for this message.</li>
        ) : null}
        {!error &&
          entries.map((entry) => (
            <li key={entry.id}>
              <strong>{formatDate(entry.createdAt)}</strong>
              <br />
              <span>IP: {entry.ipAddress ?? "Unknown"}</span>
              <br />
              <span>User-Agent: {entry.userAgent ?? "Unknown"}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}
