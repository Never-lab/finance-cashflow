/**
 * Palette e tooltip condivisi per grafici Recharts (tema scuro Cash Flow).
 */
import { formatEur } from "@shared/lib/stats";

/** Colori e sfondo pannello per assi, griglia e serie. */
export const CHART = {
  teal: "#6ecfbc",
  clay: "#e07a4a",
  muted: "#8f9a94",
  grid: "#3d4642",
  panel: "#2a312e",
};

type TipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

/** Tooltip euro formattato per barre/aree Recharts. */
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
