import { formatEur } from "../../lib/stats";

export const CHART = {
  teal: "#1d4e4a",
  clay: "#c45c26",
  muted: "#5c655f",
  grid: "#ebe4d6",
  panel: "#fffdf8",
};

type TipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label != null && label !== "" && (
        <div className="chart-tooltip-label">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </div>
      )}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="chart-tooltip-row">
          <span
            className="chart-tooltip-dot"
            style={{ background: String(p.color ?? CHART.teal) }}
          />
          <span>{p.name}</span>
          <strong>{formatEur(Number(p.value ?? 0))}</strong>
        </div>
      ))}
    </div>
  );
}
