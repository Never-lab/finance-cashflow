import { Fragment } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Layer,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, CHART } from "./chartTheme";
import { formatEur, type SankeyData } from "../../lib/stats";

type CumPoint = { date: string; balance: number; dayNet: number };
type MonthPoint = { month: string; income: number; expense: number; net: number };
type CatPoint = { category: string; total: number; pct: number };
type Heat = {
  months: string[];
  categories: string[];
  matrix: number[][];
  max: number;
};

function shortDate(d: string): string {
  if (d.length >= 10) return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  if (d.length >= 7) return d.slice(5);
  return d;
}

function shortMonth(m: string): string {
  return m.length >= 7 ? m.slice(5) : m;
}

export function CashflowCurve({ data }: { data: CumPoint[] }) {
  if (data.length === 0) {
    return <p className="muted">Nessun dato nel periodo.</p>;
  }
  const end = data[data.length - 1]!;
  return (
    <div className="chart-hero">
      <div className="chart-hero-meta">
        <span className="kpi-label">Saldo cumulato periodo</span>
        <span className={`chart-hero-value ${end.balance >= 0 ? "pos" : "neg"}`}>
          {formatEur(end.balance)}
        </span>
      </div>
      <div className="chart-box tall">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cfFill" x1="0" y1="0" x2="0" y2="1">
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
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="balance"
              name="Saldo"
              stroke={CHART.teal}
              strokeWidth={2.25}
              fill="url(#cfFill)"
              dot={false}
              activeDot={{ r: 4, fill: CHART.teal, stroke: CHART.panel, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function IncomeExpenseBars({ data }: { data: MonthPoint[] }) {
  if (data.length === 0) return <p className="muted">Nessun mese nel periodo.</p>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          barGap={4}
          barCategoryGap="28%"
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={shortMonth}
            tick={{ fill: CHART.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              new Intl.NumberFormat("it-IT", { notation: "compact" }).format(Number(v))
            }
            tick={{ fill: CHART.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="income"
            name="Entrate"
            fill={CHART.teal}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="expense"
            name="Uscite"
            fill={CHART.clay}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data }: { data: CatPoint[] }) {
  if (data.length === 0) return <p className="muted">Nessuna uscita nel periodo.</p>;
  return (
    <div className="cat-bars">
      {data.map((row) => (
        <div key={row.category} className="cat-bar-row">
          <div className="cat-bar-head">
            <span>{row.category}</span>
            <span className="cat-bar-meta">
              {formatEur(row.total)} · {row.pct.toFixed(0)}%
            </span>
          </div>
          <div className="cat-bar-track">
            <div className="cat-bar-fill" style={{ width: `${Math.min(row.pct, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SpendingHeatmap({ data }: { data: Heat }) {
  if (data.months.length === 0 || data.categories.length === 0) {
    return <p className="muted">Servono più mesi/categorie per la heatmap.</p>;
  }
  const max = data.max || 1;
  return (
    <div className="heatmap-wrap">
      <div
        className="heatmap"
        style={{
          gridTemplateColumns: `minmax(88px, 1.2fr) repeat(${data.months.length}, minmax(32px, 1fr))`,
        }}
      >
        <div className="heatmap-corner" />
        {data.months.map((m) => (
          <div key={m} className="heatmap-colhead">
            {shortMonth(m)}
          </div>
        ))}
        {data.categories.map((cat, ci) => (
          <Fragment key={cat}>
            <div className="heatmap-rowhead" title={cat}>
              {cat}
            </div>
            {data.months.map((m, mi) => {
              const v = data.matrix[mi]?.[ci] ?? 0;
              const intensity = v / max;
              const mix = Math.round(12 + intensity * 78);
              return (
                <div
                  key={`${cat}-${m}`}
                  className="heatmap-cell"
                  title={`${cat} · ${m}: ${formatEur(v)}`}
                  style={{
                    background:
                      v <= 0
                        ? "var(--bg-2)"
                        : `color-mix(in srgb, ${CHART.clay} ${mix}%, ${CHART.panel})`,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="muted tiny heatmap-legend">Più scuro = più spesa in quella categoria/mese</p>
    </div>
  );
}

const SANKEY_COLORS = [
  CHART.teal,
  "#3a6b8c",
  CHART.clay,
  "#b08900",
  "#6b7c5c",
  "#5c4d7a",
  "#8b4513",
  "#2f4f4f",
  "#2a6a64",
];

function SankeyNode(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name?: string };
  containerWidth?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, payload, containerWidth = 0 } = props;
  const name = payload?.name ?? "";
  const isRight = x > containerWidth / 2;
  const isHub = name.startsWith("Entrate");
  const isSave = name.startsWith("Risparmio");
  const fill = isSave || isHub || !isRight ? CHART.teal : SANKEY_COLORS[index % SANKEY_COLORS.length]!;

  return (
    <Layer key={`sn-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.92} radius={2} />
      <text
        x={isRight ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isRight ? "end" : "start"}
        dominantBaseline="middle"
        fontSize={11}
        fill={CHART.muted}
      >
        {name.length > 28 ? `${name.slice(0, 26)}…` : name}
      </text>
    </Layer>
  );
}

function SankeyLink(props: {
  sourceX?: number;
  targetX?: number;
  sourceY?: number;
  targetY?: number;
  sourceControlX?: number;
  targetControlX?: number;
  linkWidth?: number;
  index?: number;
  payload?: { source?: { name?: string }; target?: { name?: string }; value?: number };
}) {
  const {
    sourceX = 0,
    targetX = 0,
    sourceY = 0,
    targetY = 0,
    sourceControlX = 0,
    targetControlX = 0,
    linkWidth = 0,
    index = 0,
    payload,
  } = props;
  const toSave = payload?.target?.name?.startsWith("Risparmio");
  const stroke = toSave ? CHART.teal : SANKEY_COLORS[index % SANKEY_COLORS.length]!;

  return (
    <path
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      fill="none"
      stroke={stroke}
      strokeWidth={Math.max(linkWidth, 1)}
      strokeOpacity={0.35}
    />
  );
}

export function CashflowSankeyChart({ data }: { data: SankeyData }) {
  const height = Math.min(520, Math.max(300, data.nodes.length * 36));
  const spendPct =
    data.income > 0 ? Math.min(100, Math.round((data.expense / data.income) * 100)) : 0;

  return (
    <div className="sankey-block">
      <div className="stat-row sankey-kpis">
        <div className="stat-card compact">
          <span className="stat-label">Entrate</span>
          <span className="stat-value pos">{formatEur(data.income)}</span>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Uscite</span>
          <span className="stat-value neg">{formatEur(data.expense)}</span>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Risparmio</span>
          <span className={`stat-value ${data.net >= 0 ? "pos" : "neg"}`}>
            {formatEur(data.net)}
          </span>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Savings rate</span>
          <span className={`stat-value ${data.savingsRate > 0 ? "pos" : ""}`}>
            {data.savingsRate.toFixed(0)}%
          </span>
        </div>
        <div className="stat-card compact sankey-spend">
          <div className="sankey-spend-head">
            <span className="stat-label">Quota spesa</span>
            <span className="stat-value compact-num">{spendPct}%</span>
          </div>
          <div className="cat-bar-track">
            <div className="cat-bar-fill clay" style={{ width: `${spendPct}%` }} />
          </div>
        </div>
      </div>
      <div className="chart-box sankey-box" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={{ nodes: data.nodes, links: data.links }}
            nodeWidth={12}
            nodePadding={18}
            margin={{ top: 12, bottom: 12, left: 12, right: 12 }}
            linkCurvature={0.55}
            node={<SankeyNode />}
            link={<SankeyLink />}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as {
                  source?: { name?: string };
                  target?: { name?: string };
                  value?: number;
                };
                if (!p?.value) return null;
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip-label">
                      {p.source?.name ?? "?"} → {p.target?.name ?? "?"}
                    </div>
                    <div className="chart-tooltip-row">
                      <strong>{formatEur(Number(p.value))}</strong>
                    </div>
                  </div>
                );
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
