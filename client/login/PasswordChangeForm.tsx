import type { FormEvent } from "react";

import { getErrorMessage } from "../shared/getErrorMessage";

interface PasswordChangeFormProps {
  /**
   * Reports progress and error messages to the status line.
   */
  onStatus: (message: string) => void;

  /**
   * Called once the password has been updated.
   */
  onDone: () => void;
}

/**
 * Forced password change form shown after the first sign in.
 *
 * @param {PasswordChangeFormProps} arg0 [!important, minimum length matches the server validation]
 */
export default function PasswordChangeForm({
  onStatus,
  onDone,
}: PasswordChangeFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    onStatus("Updating password…");

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: formData.get("password") }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };

        throw new Error(payload.error ?? `Request failed (${response.status})`);
      }

      form.reset();
      onDone();
    } catch (error) {
      onStatus(getErrorMessage(error));
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <p className="muted">Set a new password to continue.</p>

      <label htmlFor="new-password">New password</label>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
      />

      <button type="submit">Update password</button>
    </form>
  );
}
