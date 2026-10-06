import { useCallback, useEffect, useState } from "react";
import type { LogFileResponse } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import { useInterval } from "../shared/useInterval";

interface LogContentProps {
  selected: string | null;

  error: string | null;
}

/**
 * Output pane for the selected log file.
 *
 * @param {LogContentProps} arg0 [!important, error takes precedence over content]
 */
export default function LogContent({
  selected,
  error: logListError,
}: LogContentProps) {
  const [content, setContent] = useState<LogFileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadContent = useCallback((name: string) => {
    setIsLoading(true);
    fetchJson<LogFileResponse>(
      `/api/logs/${encodeURIComponent(name)}?lines=200`,
    )
      .then((next) => {
        // reverse the log content
        next.content = next.content.split("\n").reverse().join("\n");

        setContent(next);
        setError(null);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        setError(getErrorMessage(caught));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selected) {
      loadContent(selected);
    }
  }, [selected, loadContent]);

  const [pollInterval, setPollInterval] = useState(10_000);
  const [nextPoll, setNextPoll] = useState(Date.now() + pollInterval);

  const [seconds, setSeconds] = useState(Math.floor(pollInterval / 1000));
  useInterval(() => {
    if (!selected) {
      return;
    }

    const s = Math.floor((nextPoll - Date.now()) / 1000);
    setSeconds(Math.max(0, s));

    if (Date.now() >= nextPoll) {
      loadContent(selected);
      setNextPoll(Date.now() + pollInterval);
    }
  }, 1000);

  const output = (() => {
    if (error) {
      return error;
    }
    if (logListError) {
      return logListError;
    }

    if (content) {
      return content.content || "No log content available.";
    }

    return "Select a log to view its contents.";
  })();

  return (
    <section className="panel inset">
      <div className="panel-heading">
        <div>
          <h2>
            {content
              ? `${content.log.name}${content.log.exists ? "" : " (missing)"}`
              : "Log output"}
          </h2>
          <small className="muted">Showing last 200 lines.</small>
        </div>

        <div>
          <select
            value={pollInterval.toString()}
            onChange={(e) => {
              const interval = Number(e.currentTarget.value);

              setPollInterval(interval);
              setNextPoll(Math.min(Date.now() + interval, nextPoll));
            }}
          >
            <option value="2000">2 Seconds</option>
            <option value="5000">5 Seconds</option>
            <option value="10000">10 Seconds</option>
            <option value="30000">30 Seconds</option>
          </select>

          <button
            type="button"
            onClick={() => selected && loadContent(selected)}
            disabled={isLoading || !selected}
            style={{
              marginLeft: "0.5rem",
              marginRight: "0.5rem",
            }}
          >
            Tail Now ({isLoading ? 0 : seconds}s)
          </button>
        </div>
      </div>

      <pre className="log-output">{output}</pre>
    </section>
  );
}
