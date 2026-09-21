/**
 * Tab Buste paga: import PDF HR (OSRA/OLUIT), KPI netto/lordo/ferie, grafici storici
 * e tabella cedolini con allineamento accredito banca quando disponibile.
 */
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
import type { BankMatchStatus, PayslipLeave, PayslipRecord, PayslipSummary } from "@shared/lib/payslip";
import { formatEur } from "@shared/lib/stats";
import { ChartTooltip, CHART } from "./charts/chartTheme";

type Props = {
  refreshKey?: number;
  onToast?: (msg: string) => void;
};

function periodLabel(p: { periodMonth: number; periodYear: number; periodLabel: string }): string {
  return `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear} · ${p.periodLabel}`;
}

function matchStatusLabel(status: BankMatchStatus): string {
  if (status === "matched") return "da banca";
  if (status === "doubt") return "dubbio · cedolino";
  return "da cedolino";
}

function netHint(p: PayslipRecord): string {
  const parts = [matchStatusLabel(p.bankMatchStatus)];
  if (p.accAnomalous) parts.push("Acc. c.c. anomalo");
  return parts.join(" · ");
}

function formatItDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatLeaveHours(v: number | null): string {
  return v != null ? `${v} h` : "—";
}

/** Riga compatta ore ferie/permessi: solo residui AP/AC (mai spettanti). */
function formatLeaveApAc(leave: PayslipLeave): string {
  const ap = leave.ap.residue;
  const ac = leave.ac.residue;
  if (ap == null && ac == null) return formatLeaveHours(leave.residue);
  if (ac == null && leave.ac.spettanti == null && leave.ac.godute == null) {
    return formatLeaveHours(ap);
  }
  return `AP ${formatLeaveHours(ap)} · AC ${formatLeaveHours(ac)}`;
}

function LeaveApAcTable({ title, leave }: { title: string; leave: PayslipLeave }) {
  const rows = [
    { label: "Spett.", ap: leave.ap.spettanti, ac: leave.ac.spettanti },
    { label: "Godute", ap: leave.ap.godute, ac: leave.ac.godute },
    { label: "Residue", ap: leave.ap.residue, ac: leave.ac.residue },
  ];
  return (
    <div className="payslip-leave-block">
      <h4>{title}</h4>
      <table className="payslip-leave-grid">
        <thead>
          <tr>
            <th />
            <th className="num">AP</th>
            <th className="num">AC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="num">{formatLeaveHours(row.ap)}</td>
              <td className="num">{formatLeaveHours(row.ac)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayslipTab({ refreshKey = 0, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<PayslipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [errors, setErrors] = useState<{ file: string; error: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await api.getPayslips());
      setSelectedIds(new Set());
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
    const picked = [...(e.target.files ?? [])];
    e.target.value = "";
    const files = picked.filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    if (files.length === 0) {
      onToast?.("Nessun file PDF selezionato");
      return;
    }

    setImporting(true);
    setImportProgress({ done: 0, total: files.length });
    setErrors([]);
    try {
      const res = await api.importPayslips(files, (done, total) => {
        setImportProgress({ done, total });
      });
      setSummary(res.summary);
      setSelectedIds(new Set());
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
      setImportProgress(null);
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], checked: boolean) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  };

  const onDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !confirm(
        ids.length === 1
          ? "Eliminare il cedolino selezionato (DB + PDF)?"
          : `Eliminare ${ids.length} cedolini selezionati (DB + PDF)?`,
      )
    ) {
      return;
    }
    setDeleting(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const id of ids) {
        try {
          await api.deletePayslip(id);
          ok++;
        } catch {
          fail++;
        }
      }
      await load();
      if (fail === 0) onToast?.(ok === 1 ? "Cedolino eliminato" : `Eliminati ${ok} cedolini`);
      else onToast?.(`Eliminati ${ok}, errori ${fail}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !summary) {
    return <div className="boot">Caricamento buste paga…</div>;
  }

  const latest = summary?.latest;
  const hasData = (summary?.payslips.length ?? 0) > 0;
  const rows = [...(summary?.payslips ?? [])].reverse();
  const rowIds = rows.map((p) => p.id);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  return (
    <div className="payslip-tab">
      <section className="panel payslip-upload">
        <h3>Importa cedolini PDF</h3>
        <p className="muted">
          Formato OSRA/OLUIT dal portale HR (AFEA / ITWorking). Puoi selezionare tanti PDF
          insieme (es. 30): vengono elaborati a gruppi. Conversione PDF→Markdown (anydoc) con
          fallback testo; netto KPI da banca se match, altrimenti cedolino. I PDF restano sul
          volume.
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
          {importing && importProgress
            ? `Importazione ${importProgress.done}/${importProgress.total}…`
            : importing
              ? "Importazione…"
              : "Scegli PDF (anche molti)"}
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
                {latest ? `${periodLabel(latest)} · ${netHint(latest)}` : "—"}
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
                {latest ? formatLeaveApAc(latest.leaveFerie) : "—"}
              </span>
              <span className="stat-hint">
                Tot. {formatLeaveHours(latest?.leaveFerie.residue ?? null)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Permessi residui</span>
              <span className="stat-value">
                {latest ? formatLeaveApAc(latest.leavePerm) : "—"}
              </span>
              <span className="stat-hint">
                Tot. {formatLeaveHours(latest?.leavePerm.residue ?? null)}
              </span>
            </div>
          </div>

          {latest && (
            <section className="panel payslip-leave-panel">
              <h3>Ferie, festività e permessi · AP / AC ({periodLabel(latest)})</h3>
              <div className="payslip-leave-split">
                <LeaveApAcTable title="Ferie" leave={latest.leaveFerie} />
                <LeaveApAcTable title="Festività" leave={latest.leaveFest} />
                <LeaveApAcTable title="Permessi" leave={latest.leavePerm} />
              </div>
            </section>
          )}

          <div className="chart-grid payslip-charts">
            <section className="panel">
              <h3>Netto vs lordo</h3>
              <p className="muted tiny">
                Barre: lordo, netto KPI (banca se match, altrimenti cedolino), accredito banca.
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
              <h3>Ferie e permessi (residui AP / AC)</h3>
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
                      dataKey="ferieResidueAp"
                      name="Ferie AP"
                      stroke={CHART.teal}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ferieResidueAc"
                      name="Ferie AC"
                      stroke="#4a9e8c"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="permResidueAp"
                      name="Perm AP"
                      stroke={CHART.clay}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="permResidueAc"
                      name="Perm AC"
                      stroke="#d4956a"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="panel payslip-table-panel">
            <div className="payslip-table-head">
              <h3>Elenco cedolini</h3>
              <button
                type="button"
                className="btn sm danger"
                disabled={!someSelected || deleting}
                onClick={() => void onDeleteSelected()}
              >
                {deleting
                  ? "Eliminazione…"
                  : someSelected
                    ? `Elimina selezionati (${selectedIds.size})`
                    : "Elimina selezionati"}
              </button>
            </div>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th className="payslip-check-col">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        disabled={rowIds.length === 0 || deleting}
                        onChange={(e) => toggleAll(rowIds, e.target.checked)}
                        aria-label="Seleziona tutti i cedolini"
                      />
                    </th>
                    <th>Periodo</th>
                    <th className="num">Lordo</th>
                    <th className="num">Netto</th>
                    <th className="num">Cedolino</th>
                    <th>Match</th>
                    <th className="num">Δ banca</th>
                    <th className="num">Ferie</th>
                    <th className="num">Fest</th>
                    <th className="num">Perm</th>
                    <th>Valuta</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    /** Scostamento banca vs netto cedolino risolto. */
                    const delta =
                      p.bankCredit != null && p.payslipNet != null
                        ? Math.round((p.bankCredit - p.payslipNet) * 100) / 100
                        : null;
                    const checked = selectedIds.has(p.id);
                    return (
                      <tr key={p.id} className={checked ? "row-selected" : undefined}>
                        <td className="payslip-check-col">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={deleting}
                            onChange={(e) => toggleOne(p.id, e.target.checked)}
                            aria-label={`Seleziona ${periodLabel(p)}`}
                          />
                        </td>
                        <td>
                          <div>{periodLabel(p)}</div>
                          {p.accAnomalous && <div className="muted tiny">Acc. c.c. anomalo</div>}
                        </td>
                        <td className="num">{p.grossTotal != null ? formatEur(p.grossTotal) : "—"}</td>
                        <td className="num">{p.netPay != null ? formatEur(p.netPay) : "—"}</td>
                        <td className="num">{p.payslipNet != null ? formatEur(p.payslipNet) : "—"}</td>
                        <td className="muted tiny">{matchStatusLabel(p.bankMatchStatus)}</td>
                        <td className="num">
                          {delta != null ? (
                            <span className={delta >= 0 ? "pos" : "neg"}>{formatEur(delta)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num leave-ap-ac">{formatLeaveApAc(p.leaveFerie)}</td>
                        <td className="num leave-ap-ac">{formatLeaveApAc(p.leaveFest)}</td>
                        <td className="num leave-ap-ac">{formatLeaveApAc(p.leavePerm)}</td>
                        <td>{formatItDate(p.payDate)}</td>
                        <td className="muted tiny">{p.sourceFile ?? "—"}</td>
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
