const WIDTH = 300;
const HEIGHT = 70;
const PADDING = 4;

interface LineChartProps {
  /**
   * Values to plot, oldest first.
   */
  values: number[];

  /**
   * Accessible description of the chart.
   */
  label: string;
}

/**
 * Smooth unfilled SVG line chart.
 *
 * @param {LineChartProps} arg0 [!important, no description here]
 */
export default function LineChart({ values, label }: LineChartProps) {
  if (values.length < 2) {
    return null;
  }

  const max = Math.max(...values, 1);
  const step = (WIDTH - PADDING * 2) / (values.length - 1);

  const points = values.map((value, index) => ({
    x: PADDING + index * step,
    y: HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2),
  }));

  // Horizontal-tangent cubic segments give rounded corners without overshoot.
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const midX = (prev.x + next.x) / 2;

    path += ` C ${midX} ${prev.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
