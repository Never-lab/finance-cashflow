/**
 * Grafici tab Investimenti: andamento patrimonio, torta allocazione per tipo,
 * serie prezzo singolo strumento quotato.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, CHART } from "./chartTheme";
import { formatEur } from "@shared/lib/stats";

type HistoryPoint = { date: string; value: number };
type AllocationSlice = { label: string; value: number; pct: number };
type PricePoint = { asOf: string; close: number };

function shortDate(d: string): string {
  if (d.length >= 10) return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  if (d.length >= 7) return d.slice(5);
  return d;
}

export function PortfolioHistoryChart({ data }: { data: HistoryPoint[] }) {
  if (data.length === 0) {
    return <p className="muted">Nessuno storico disponibile nel periodo.</p>;
  }
  const end = data[data.length - 1]!;
  return (
    <div className="chart-hero">
      <div className="chart-hero-meta">
        <span className="kpi-label">Valore patrimonio a fine periodo</span>
        <span className="chart-hero-value">{formatEur(end.value)}</span>
      </div>
      <div className="chart-box tall">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.teal} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART.teal} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: CHART.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(v) =>
                new Intl.NumberFormat("it-IT", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(Number(v))
              }
              tick={{ fill: CHART.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip labelFormatter={shortDate} />} />
            <Area
              type="monotone"
              dataKey="value"
              name="Valore"
              stroke={CHART.teal}
              strokeWidth={2.25}
              fill="url(#portfolioFill)"
              dot={false}
              activeDot={{ r: 4, fill: CHART.teal, stroke: CHART.panel, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const ALLOCATION_COLORS = [CHART.teal, CHART.clay, "#3a6b8c", "#b08900", "#6b7c5c"];

export function AllocationChart({ data }: { data: AllocationSlice[] }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="muted">Nessuna allocazione da mostrare.</p>;
  }
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={56}
            outerRadius={92}
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            formatter={(value: string) => <span style={{ color: CHART.muted }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InstrumentPriceChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0) {
    return <p className="muted">Nessuna quotazione — aggiorna saldo manuale.</p>;
  }
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.clay} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART.clay} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="asOf"
            tickFormatter={shortDate}
            tick={{ fill: CHART.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: CHART.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<ChartTooltip labelFormatter={shortDate} />} />
          <Area
            type="monotone"
            dataKey="close"
            name="Prezzo"
            stroke={CHART.clay}
            strokeWidth={2}
            fill="url(#priceFill)"
            dot={false}
            activeDot={{ r: 4, fill: CHART.clay, stroke: CHART.panel, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
