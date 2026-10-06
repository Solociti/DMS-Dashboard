import { useEffect, useState } from "react";
import { Outlet } from "react-router";

import { fetchJson } from "../shared/fetchJson";
import { redirectToLogin } from "../shared/redirectToLogin";
import type { AuthSession } from "../shared/types";

/**
 * Route guard that renders child routes only for a fully authenticated session.
 */
export default function RequireSession() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchJson<AuthSession>("/api/auth/session")
      .then((session) => {
        if (!session.authenticated || session.mustChangePassword) {
          redirectToLogin();
          return;
        }

        setReady(true);
      })
      .catch(() => redirectToLogin());
  }, []);

  return ready ? <Outlet /> : null;
}
