import { useEffect, useState } from "react";

import type { WarningState } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { formatDate } from "../shared/formatDate";
import { getErrorMessage } from "../shared/getErrorMessage";

/**
 * Configuration warnings panel. It stays hidden while there is nothing to report.
 */
export default function WarningsPanel() {
  const [state, setState] = useState<WarningState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (recheck: boolean) => {
    fetchJson<WarningState>(
      recheck ? "/api/warnings/recheck" : "/api/warnings",
      { method: recheck ? "POST" : "GET" },
    )
      .then((next) => {
        setState(next);
        setError(null);
      })
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  };

  useEffect(() => {
    load(false);
  }, []);

  if (!error && (!state || state.warnings.length === 0)) {
    return null;
  }

  return (
    <section className="panel warning-panel">
      <div className="panel-heading">
        <div>
          <h2>Configuration warnings</h2>
          <p className="muted">
            {error
              ? "Warning refresh failed."
              : `Last checked ${formatDate(state?.checkedAt ?? null)}.`}
          </p>
        </div>

        <button type="button" onClick={() => load(true)}>
          Recheck warnings
        </button>
      </div>

      <ul className="warning-list">
        {error ? <li>{error}</li> : null}
        {state?.warnings.map((warning) => (
          <li key={warning.code}>
            <strong>{warning.title}</strong>
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
