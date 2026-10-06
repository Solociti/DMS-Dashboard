import type {
  OpenScope,
  OpenSortField,
  SortDirection,
} from "../../common/types";

export interface MessageFilterValues {
  query: string;
  scope: OpenScope;
  sort: OpenSortField;
  direction: SortDirection;
}

interface MessageFiltersProps {
  /**
   * Current filter values.
   */
  filters: MessageFilterValues;

  /**
   * Called with the full updated filter values on any change.
   */
  onChange: (filters: MessageFilterValues) => void;
}

/**
 * Search box, ownership scope and sort controls for the message list.
 *
 * @param {MessageFiltersProps} arg0 [!important, values are controlled by the parent]
 */
export default function MessageFilters({
  filters,
  onChange,
}: MessageFiltersProps) {
  return (
    <div className="filter-row">
      <input
        type="search"
        aria-label="Search emails"
        placeholder="Search address or subject"
        value={filters.query}
        onChange={(event) =>
          onChange({ ...filters, query: event.target.value })
        }
      />

      <select
        aria-label="Which emails"
        value={filters.scope}
        onChange={(event) =>
          onChange({ ...filters, scope: event.target.value as OpenScope })
        }
      >
        <option value="mine">My emails</option>
        <option value="all">All emails</option>
      </select>
    </div>
  );
}
