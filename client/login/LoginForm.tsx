import type { FormEvent } from "react";

import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import type { AuthSession } from "../shared/types";

interface LoginFormProps {
  /**
   * Reports progress and error messages to the status line.
   */
  onStatus: (message: string) => void;

  /**
   * Called with the new session after a successful sign in.
   */
  onSession: (session: AuthSession) => void;
}

/**
 * Email and password sign-in form.
 *
 * @param {LoginFormProps} arg0 [!important, the form never stores the password in state]
 */
export default function LoginForm({ onStatus, onSession }: LoginFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    onStatus("Signing in…");

    try {
      const session = await fetchJson<AuthSession>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      form.reset();
      onSession(session);
    } catch (error) {
      onStatus(getErrorMessage(error));
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />

      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <button type="submit">Sign in</button>
    </form>
  );
}
