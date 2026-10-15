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
  const [counts, setCounts] = useState({ total: 0, visible: 0 });

  useEffect(() => {
    if (!msgId) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    const suffix = showIgnored ? "?includeIgnored=1" : "";

    fetchJson<{
      list: OpenLogEntry[];
      count: { total: number; visible: number };
    }>(`/api/opens/${encodeURIComponent(msgId)}${suffix}`)
      .then((next) => {
        if (!cancelled) {
          setEntries(next.list);
          setCounts(next.count);
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

  const issueTitle = loadFailed
    ? "Overview failed to load"
    : msgId
      ? ``
      : "Select a message to inspect open events.";

  return (
    <section className="panel inset">
      <div className="panel-heading">
        {hideHeading ? null : (
          <h2
            style={{
              display: "inline-block",
              marginBottom: 0,
            }}
          >
            Open Details
          </h2>
        )}

        <div>
          {msgId && counts.total > counts.visible ? (
            <button
              type="button"
              onClick={() => setShowIgnored((value) => !value)}
            >
              {showIgnored ? "Hide ignored hits" : "Show ignored hits"}
            </button>
          ) : null}
        </div>

        {msgId ? (
          <span>
            {counts.visible} of {counts.total}
          </span>
        ) : null}
      </div>

      <p>{issueTitle}</p>
      {message ? <MessageInfo message={message} /> : null}

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
              {entry.ignored ? (
                <span
                  className="badge"
                  style={{ marginLeft: "0.5rem", fontSize: "0.9em" }}
                >
                  ignored
                </span>
              ) : null}
              <br />

              <dl className="message-info-fields">
                <dt>IP</dt>
                <dd>{entry.ipAddress ?? "-"}</dd>

                <dt>User-Agent</dt>
                <dd>{entry.userAgent ?? "-"}</dd>
              </dl>

              {entry.userAgentDevice &&
              (entry.userAgentDevice.browser ||
                entry.userAgentDevice.device ||
                entry.userAgentDevice.os) ? (
                <>
                  <hr />
                  <div className="device-info">
                    {entry.userAgentDevice.browser && (
                      <div className="badge">
                        Browser: {entry.userAgentDevice.browser}
                      </div>
                    )}
                    {entry.userAgentDevice.device && (
                      <div className="badge">
                        Device: {entry.userAgentDevice.device}
                      </div>
                    )}
                    {entry.userAgentDevice.os && (
                      <div className="badge">
                        OS: {entry.userAgentDevice.os}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </li>
          ))}
      </ul>
    </section>
  );
}
