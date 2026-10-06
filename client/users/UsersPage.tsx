import { useEffect, useState } from "react";

import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import type { ManagedUser } from "../shared/types";
import UserRow from "./UserRow";

/**
 * Users page: edit account emails and set new passwords.
 */
export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<ManagedUser[]>("/api/users")
      .then(setUsers)
      .catch((caught: unknown) => setError(getErrorMessage(caught)));
  }, []);

  const status =
    error ??
    (users ? `${users.length} user${users.length === 1 ? "" : "s"}` : "");

  return (
    <section className="panel stack">
      <div className="panel-heading">
        <div>
          <h2>Users</h2>
          <p className="muted">Update account email addresses and passwords.</p>
        </div>
      </div>

      <p className="muted" role="status" aria-live="polite">
        {status}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>New password</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {users === null && !error ? (
              <tr>
                <td colSpan={4}>Loading users…</td>
              </tr>
            ) : null}
            {users?.map((user) => <UserRow key={user.id} user={user} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
