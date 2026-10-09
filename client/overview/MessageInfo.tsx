import type { OpenSummary } from "../../common/types";
import { formatDate } from "../shared/formatDate";

interface MessageInfoProps {
  /**
   * Message whose full, untruncated details are shown.
   */
  message: OpenSummary;
}

/**
 * Full metadata for a tracked message.
 *
 * @param {MessageInfoProps} arg0 [!important, no description here]
 */
export default function MessageInfo({ message }: MessageInfoProps) {
  return (
    <div className="message-info">
      <h3 className="message-info-subject">
        {message.subject ?? "(no subject)"}
      </h3>

      <dl className="message-info-fields">
        <dt>From</dt>
        <dd>{message.sender ?? "-"}</dd>

        <dt>To</dt>
        <dd>
          {message.recipients.length === 0
            ? "-"
            : message.recipients.map((recipient) => (
                <div key={recipient}>{recipient}</div>
              ))}
        </dd>

        <dt>Sent</dt>
        <dd>{message.sentAt ? formatDate(message.sentAt) : "-"}</dd>

        <dt>Opens</dt>
        <dd>{message.totalOpens}</dd>

        <dt>Last opened</dt>
        <dd>{formatDate(message.lastOpened)}</dd>
      </dl>

      <p className="message-info-id">{message.msgId}</p>
    </div>
  );
}
