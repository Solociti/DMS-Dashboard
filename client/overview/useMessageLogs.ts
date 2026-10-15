import { useEffect, useState } from "react";

import type { LogSearchResponse } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";

interface MessageLogsState {
  result: LogSearchResponse | null;
  transactionId: string | null;
  loading: boolean;
  error: string | null;
}

function search(terms: string[]): Promise<LogSearchResponse> {
  return fetchJson<LogSearchResponse>(
    `/api/logs/search?q=${encodeURIComponent(terms.join("|"))}`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds the transaction (queue) id on the cleanup line, then searches all logs for uid, message id and transaction id.
 */
export function useMessageLogs(uid: string, messageId: string): MessageLogsState {
  const [state, setState] = useState<MessageLogsState>({
    result: null,
    transactionId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const first = await search([messageId]);
      // Stored ids already carry their angle brackets.
      const bareId = messageId.replace(/^<|>$/g, "");
      const pattern = new RegExp(
        `: ([0-9A-Za-z]+): message-id=<${escapeRegExp(bareId)}>`,
      );
      const transactionId =
        first.hits.map((hit) => pattern.exec(hit.line)?.[1]).find(Boolean) ??
        null;

      const result = await search(
        transactionId
          ? [uid, messageId, transactionId]
          : [uid, messageId],
      );

      if (!cancelled) {
        setState({ result, transactionId, loading: false, error: null });
      }
    }

    load().catch((caught: unknown) => {
      if (!cancelled) {
        setState({
          result: null,
          transactionId: null,
          loading: false,
          error: getErrorMessage(caught),
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uid, messageId]);

  return state;
}
