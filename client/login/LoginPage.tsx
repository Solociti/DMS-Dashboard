import { useEffect, useState } from "react";

import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import type { AuthSession } from "../shared/types";
import { getReturnPath } from "./getReturnPath";
import LoginForm from "./LoginForm";
import PasswordChangeForm from "./PasswordChangeForm";

/**
 * Standalone sign-in screen. It is its own bundle and does not load the router.
 */
export default function LoginPage() {
  const [passwordEmail, setPasswordEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const handleSession = (session: AuthSession) => {
    if (!session.authenticated) {
      return;
    }

    if (session.mustChangePassword) {
      setPasswordEmail(session.email ?? "your account");
      setStatus(
        `Update the password for ${session.email ?? "your account"} to continue.`,
      );
      return;
    }

    window.location.replace(getReturnPath());
  };

  useEffect(() => {
    fetchJson<AuthSession>("/api/auth/session")
      .then(handleSession)
      .catch((error: unknown) => setStatus(getErrorMessage(error)));
    // The existing session is only checked once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <p className="eyebrow">Email tracking</p>
        <h1>DMS Dashboard</h1>

        {passwordEmail === null ? (
          <LoginForm onStatus={setStatus} onSession={handleSession} />
        ) : (
          <PasswordChangeForm
            onStatus={setStatus}
            onDone={() => window.location.replace(getReturnPath())}
          />
        )}

        <p className="auth-status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </main>
  );
}
