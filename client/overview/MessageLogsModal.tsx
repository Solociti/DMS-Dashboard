import type { LogSearchHit, OpenSummary } from "../../common/types";
import Modal from "../shared/Modal";
import { useMessageLogs } from "./useMessageLogs";

function groupByFile(hits: LogSearchHit[]): [string, string[]][] {
  const groups = new Map<string, string[]>();

  for (const hit of hits) {
    const lines = groups.get(hit.file) ?? [];
    lines.push(hit.line);
    groups.set(hit.file, lines);
  }

  return [...groups];
}

interface MessageLogsModalProps {
  /**
   * Message whose log lines are searched.
   */
  message: OpenSummary;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;
}

/**
 * Modal listing log lines that mention a message's uid, message id or transaction id.
 *
 * @param {MessageLogsModalProps} arg0 [!important, no description here]
 */
export default function MessageLogsModal({
  message,
  onClose,
}: MessageLogsModalProps) {
  const { result, transactionId, loading, error } = useMessageLogs(
    message.uid,
    message.messageId,
  );

  return (
    <Modal title="Message logs" onClose={onClose}>
      {loading ? <p>Searching logs...</p> : null}
      {error ? <p>{error}</p> : null}

      {result ? (
        <>
          <p>
            Transaction ID: {transactionId ?? "not found"}
            {result.truncated ? " (results truncated)" : ""}
          </p>

          {result.hits.length === 0 ? <p>No log lines found.</p> : null}

          {groupByFile(result.hits).map(([file, lines]) => (
            <div key={file}>
              <h4 style={{ margin: "0.5em 0" }}>{file}</h4>
              <pre className="log-output" style={{ minHeight: 0 }}>
                {lines.join("\n")}
              </pre>
            </div>
          ))}
        </>
      ) : null}
    </Modal>
  );
}
