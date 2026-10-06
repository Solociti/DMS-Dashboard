import { useState } from "react";
import type { FormEvent } from "react";

import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import type { ManagedUser } from "../shared/types";

interface UserRowProps {
  /**
   * User shown and edited by this row.
   */
  user: ManagedUser;
}

/**
 * Table row for editing a single user's email and password.
 *
 * @param {UserRowProps} arg0 [!important, a blank password keeps the current one]
 */
export default function UserRow({ user }: UserRowProps) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setStatus("Saving…");

    try {
      const updated = await fetchJson<Pick<ManagedUser, "id" | "email">>(
        `/api/users/${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );

      setEmail(updated.email);
      setPassword("");
      setStatus("Saved");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td className="user-id">{user.id}</td>
      <td>
        <input
          type="email"
          required
          form={`user-form-${user.id}`}
          value={email}
          aria-label={`Email for user ${user.id}`}
          onChange={(event) => setEmail(event.target.value)}
        />
      </td>
      <td>
        <input
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          placeholder="Leave blank to keep current"
          form={`user-form-${user.id}`}
          value={password}
          aria-label={`New password for ${user.email}`}
          onChange={(event) => setPassword(event.target.value)}
        />
      </td>
      <td>
        <form id={`user-form-${user.id}`} onSubmit={handleSave}>
          <button type="submit" disabled={saving}>
            Save changes
          </button>
          <span role="status">{status}</span>
        </form>
      </td>
    </tr>
  );
}
