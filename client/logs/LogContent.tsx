import type { LogFileResponse } from "../../common/types";

interface LogContentProps {
  /**
   * Latest log response, or null when none is loaded.
   */
  content: LogFileResponse | null;

  /**
   * Load error shown instead of the log output.
   */
  error: string | null;

  /**
   * True when no log files are configured.
   */
  empty: boolean;

  /**
   * Called when the tail button is pressed.
   */
  onTail: () => void;
}

/**
 * Output pane for the selected log file.
 *
 * @param {LogContentProps} arg0 [!important, error takes precedence over content]
 */
export default function LogContent({
  content,
  error,
  empty,
  onTail,
}: LogContentProps) {
  const output = error
    ? error
    : empty
      ? "Configure LOG_FILES or mount DMS logs to inspect them here."
      : content
        ? content.content || "No log content available."
        : "Select a log to view its contents.";

  return (
    <section className="panel inset">
      <div className="panel-heading">
        <div>
          <h2>
            {content
              ? `${content.log.name} (${content.log.exists ? "mounted" : "missing"})`
              : "Log output"}
          </h2>
          <p className="muted">Showing the most recent 200 lines.</p>
        </div>

        <button type="button" onClick={onTail}>
          Tail Now
        </button>
      </div>

      <pre className="log-output">{output}</pre>
    </section>
  );
}
