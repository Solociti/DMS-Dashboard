import { useEffect, useState } from "react";

import type { OpenLogEntry, OpenSummary } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { formatDate } from "../shared/formatDate";
import { getErrorMessage } from "../shared/getErrorMessage";
import MessageInfo from "./MessageInfo";

interface MessageDetailsProps {
  /**
   * Selected message, or null when nothing is selected.
   */
  message: OpenSummary | null;

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

  /**
   * Omit the "Open Details" heading when the parent already shows one.
   */
  hideHeading?: boolean;
}

/**
 * Open events for the selected message.
 *
 * @param {MessageDetailsProps} arg0 [!important, fetches its own data keyed on msgId and version]
 */
export default function MessageDetails({
  message,
  msgId,
  version,
  loadFailed,
  hideHeading = false,
}: MessageDetailsProps) {
  const [entries, setEntries] = useState<OpenLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  useEffect(() => {
    if (!msgId) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    const suffix = showIgnored ? "?includeIgnored=1" : "";

    fetchJson<OpenLogEntry[]>(
      `/api/opens/${encodeURIComponent(msgId)}${suffix}`,
    )
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
  }, [msgId, version, showIgnored]);

  const visibleCount = entries.filter((entry) => !entry.ignored).length;
  const ignoredCount = entries.length - visibleCount;

  const title = loadFailed
    ? "Overview failed to load"
    : msgId
      ? `${visibleCount} open${visibleCount === 1 ? "" : "s"}${showIgnored ? ` • ${ignoredCount} ignored` : ""}`
      : "Select a message to inspect open events.";

  return (
    <section className="panel inset">
      <div className="panel-heading">
        {hideHeading ? null : <h2>Open Details</h2>}
        <p>{title}</p>
      </div>

      {message ? <MessageInfo message={message} /> : null}

      {msgId ? (
        <button type="button" onClick={() => setShowIgnored((value) => !value)}>
          {showIgnored ? "Hide ignored hits" : "Show ignored hits"}
        </button>
      ) : null}

      <ul className="details-list">
        {error ? <li>{error}</li> : null}
        {!error && !msgId ? <li>No message selected.</li> : null}
        {!error && msgId && entries.length === 0 ? (
          <li>No open events recorded for this message.</li>
        ) : null}
        {!error &&
          entries.map((entry) => (
            <li key={entry.id} className={entry.ignored ? "muted" : undefined}>
              <strong>{formatDate(entry.createdAt)}</strong>
              {entry.ignored ? " (ignored)" : null}
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
