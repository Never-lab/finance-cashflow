/**
 * Palette e tooltip condivisi per grafici Recharts (tema scuro Cash Flow).
 */
import { formatEurDisplay } from "../../lib/privacyAmounts";

/** Colori e sfondo pannello per assi, griglia e serie. */
export const CHART = {
  teal: "#5ed4c0",
  clay: "#e08a5c",
  muted: "#8a948e",
  grid: "rgba(238, 242, 239, 0.08)",
  panel: "#161b19",
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
          <strong>{formatEurDisplay(Number(p.value ?? 0))}</strong>
        </div>
      ))}
    </div>
  );
}
