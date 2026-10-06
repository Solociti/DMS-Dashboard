import { useState } from "react";
import type { FormEvent } from "react";

interface BlacklistFormProps {
  /**
   * Adds the address; resolves true when it was added.
   */
  onAdd: (address: string) => Promise<boolean>;
}

/**
 * Form for excluding a sender address from tracking.
 *
 * @param {BlacklistFormProps} arg0 [!important, the input is cleared only after a successful add]
 */
export default function BlacklistForm({ onAdd }: BlacklistFormProps) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = address.trim();

    if (!trimmed) {
      return;
    }

    setBusy(true);

    if (await onAdd(trimmed)) {
      setAddress("");
    }

    setBusy(false);
  };

  return (
    <form className="blacklist-form" onSubmit={handleSubmit}>
      <label htmlFor="blacklist-address">Sender email address</label>

      <div className="blacklist-input-row">
        <input
          id="blacklist-address"
          name="address"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required
        />

        <button type="submit" disabled={busy}>
          Exclude sender
        </button>
      </div>
    </form>
  );
}
