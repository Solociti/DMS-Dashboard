import { refreshIntervalOptions } from "./refreshIntervalStore";

interface RefreshIntervalSelectProps {
  /**
   * Current refresh interval in milliseconds.
   */
  value: number;

  /**
   * Called with the newly chosen interval in milliseconds.
   */
  onChange: (ms: number) => void;
}

/**
 * Dropdown for choosing how often the overview refreshes.
 *
 * @param {RefreshIntervalSelectProps} arg0 [!important, no description here]
 */
export default function RefreshIntervalSelect({
  value,
  onChange,
}: RefreshIntervalSelectProps) {
  return (
    <select
      aria-label="Auto refresh interval"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {refreshIntervalOptions.map((option) => (
        <option key={option.ms} value={option.ms}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
