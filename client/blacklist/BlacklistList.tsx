interface BlacklistListProps {
  /**
   * Excluded addresses, or null while loading.
   */
  addresses: string[] | null;

  /**
   * Removes an address from the exclusion list.
   */
  onRemove: (address: string) => void;
}

/**
 * List of excluded sender addresses with remove buttons.
 *
 * @param {BlacklistListProps} arg0 [!important, removal is performed by the parent]
 */
export default function BlacklistList({
  addresses,
  onRemove,
}: BlacklistListProps) {
  return (
    <ul className="blacklist-list">
      {addresses === null ? <li>Loading…</li> : null}
      {addresses?.length === 0 ? <li>No senders are excluded.</li> : null}
      {addresses?.map((address) => (
        <li key={address}>
          <code>{address}</code>
          <button
            type="button"
            aria-label={`Remove ${address} from the exclusion list`}
            onClick={() => onRemove(address)}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
