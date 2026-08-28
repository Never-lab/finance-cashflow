import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import type { PayslipSummary } from "../lib/payslip";
import { formatEur } from "../lib/stats";
import { ChartTooltip, CHART } from "./charts/chartTheme";

type Props = {
  refreshKey?: number;
  onToast?: (msg: string) => void;
};

function periodLabel(p: { periodMonth: number; periodYear: number; periodLabel: string }): string {
  return `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear} · ${p.periodLabel}`;
}

function formatItDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function PayslipTab({ refreshKey = 0, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<PayslipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<{ file: string; error: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await api.getPayslips());
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;

    setImporting(true);
    setErrors([]);
    try {
      const res = await api.importPayslips(files);
      setSummary(res.summary);
      setErrors(res.errors);
      const msg =
        res.errors.length > 0
          ? `Importati ${res.imported} cedolini · ${res.errors.length} errori`
          : `Importati ${res.imported} cedolini`;
      onToast?.(msg);
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : "Errore import PDF");
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Eliminare questo cedolino?")) return;
    try {
      await api.deletePayslip(id);
      await load();
      onToast?.("Cedolino eliminato");
    } catch {
      onToast?.("Errore eliminazione");
    }
  };

  if (loading && !summary) {
    return <div className="boot">Caricamento buste paga…</div>;
  }

  const latest = summary?.latest;
  const hasData = (summary?.payslips.length ?? 0) > 0;

  return (
    <div className="payslip-tab">
      <section className="panel payslip-upload">
        <h3>Importa cedolini PDF</h3>
        <p className="muted">
          Formato OSRA/OLUIT dal portale HR (AFEA / ITWorking). Il netto in busta è allineato
          all&apos;accredito Mediolanum (Emolumenti) quando presente nei CSV bancari.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          hidden
          onChange={(e) => void onFiles(e)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          {importing ? "Importazione…" : "Scegli PDF"}
        </button>
        {errors.length > 0 && (
          <ul className="payslip-errors">
            {errors.map((err) => (
              <li key={err.file}>
                <strong>{err.file}</strong>: {err.error}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!hasData ? (
        <div className="empty">
          <h2>Nessun cedolino</h2>
          <p className="muted">Carica i PDF mensili dal portale HR per vedere netto, lordo e ferie.</p>
        </div>
      ) : (
        <>
          <div className="stat-row payslip-kpis">
            <div className="stat-card">
              <span className="stat-label">Ultimo netto</span>
              <span className="stat-value pos">{formatEur(latest?.netPay ?? 0)}</span>
              <span className="stat-hint">
                {latest ? periodLabel(latest) : "—"}
                {latest?.bankCredit != null ? " · da banca" : " · da cedolino"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Media netta (6 mesi)</span>
              <span className="stat-value">{formatEur(summary?.avgNet6 ?? 0)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Media lorda (6 mesi)</span>
              <span className="stat-value">{formatEur(summary?.avgGross6 ?? 0)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Ferie residue</span>
              <span className="stat-value">
                {latest?.leaveFerie.residue != null ? `${latest.leaveFerie.residue} h` : "—"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Permessi residui</span>
              <span className="stat-value">
                {latest?.leavePerm.residue != null ? `${latest.leavePerm.residue} h` : "—"}
              </span>
            </div>
          </div>

          <div className="chart-grid payslip-charts">
            <section className="panel">
              <h3>Netto vs lordo</h3>
              <p className="muted tiny">
                Barre: lordo, netto (banca o cedolino), accredito c.c. sul PDF.
              </p>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary!.chartNet} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fill: CHART.muted, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
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
                    <Legend wrapperStyle={{ fontSize: 12, color: CHART.muted }} />
                    <Bar dataKey="grossTotal" name="Lordo" fill={CHART.clay} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="netPay" name="Netto" fill={CHART.teal} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="bankCredit" name="Banca" fill="#9bb8a8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel">
              <h3>Ferie e permessi (residui)</h3>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={summary!.chartLeave} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fill: CHART.muted, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fill: CHART.muted, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="chart-tooltip">
                            <div className="chart-tooltip-label">{label}</div>
                            {payload.map((p) => (
                              <div key={String(p.dataKey)} className="chart-tooltip-row">
                                <span>{p.name}</span>
                                <strong>{p.value != null ? `${p.value} h` : "—"}</strong>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: CHART.muted }} />
                    <Line
                      type="monotone"
                      dataKey="ferieResidue"
                      name="Ferie"
                      stroke={CHART.teal}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="permResidui"
                      name="Permessi"
                      stroke={CHART.clay}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="panel payslip-table-panel">
            <h3>Elenco cedolini</h3>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th className="num">Lordo</th>
                    <th className="num">Netto</th>
                    <th className="num">Acc. c.c.</th>
                    <th className="num">Δ banca</th>
                    <th className="num">Ferie R</th>
                    <th className="num">Perm R</th>
                    <th>Valuta</th>
                    <th>File</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...(summary?.payslips ?? [])].reverse().map((p) => {
                    const delta =
                      p.bankCredit != null && p.netToAccount != null
                        ? Math.round((p.bankCredit - p.netToAccount) * 100) / 100
                        : null;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div>{periodLabel(p)}</div>
                          {p.bankCredit != null && p.netPay === p.bankCredit && (
                            <div className="muted tiny">Netto da banca</div>
                          )}
                        </td>
                        <td className="num">{p.grossTotal != null ? formatEur(p.grossTotal) : "—"}</td>
                        <td className="num">{p.netPay != null ? formatEur(p.netPay) : "—"}</td>
                        <td className="num">{p.netToAccount != null ? formatEur(p.netToAccount) : "—"}</td>
                        <td className="num">
                          {delta != null ? (
                            <span className={delta >= 0 ? "pos" : "neg"}>{formatEur(delta)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num">
                          {p.leaveFerie.residue != null ? `${p.leaveFerie.residue} h` : "—"}
                        </td>
                        <td className="num">
                          {p.leavePerm.residue != null ? `${p.leavePerm.residue} h` : "—"}
                        </td>
                        <td>{formatItDate(p.payDate)}</td>
                        <td className="muted tiny">{p.sourceFile ?? "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => void onDelete(p.id)}
                          >
                            Elimina
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
