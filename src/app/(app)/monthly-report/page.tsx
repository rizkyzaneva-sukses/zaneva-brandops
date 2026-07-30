'use client';

import { useState, useEffect } from 'react';
import {
  getMonthOptions,
  getPeriodsForMonth,
  formatNum,
  formatIdInput,
  parseNum,
  calcPct,
  calcEffectivePct,
  getKpiStatusClass,
  getMonthlyAggMode,
  rollupMonthlyValues,
} from '@/lib/utils';

interface MonthlyReport {
  id: string;
  brand_id: string;
  brand_name: string;
  month_label: string;
  month_year: string;
  status: string;
  scorecard: ScorecardEntry[];
  keberhasilan: string;
  kegagalan: string;
  insight_kompetitor: string;
  rencana_strategis: string;
  submitted_by: string;
}
interface ScorecardEntry {
  kpi_name: string;
  unit: string;
  actual_monthly: number;
  target_monthly: number;
  pct: number;
  score: number;
  higher_is_better?: boolean;
  agg_mode?: 'sum' | 'avg';
  weeks_included?: number;
}
interface Brand { id: string; name: string; }

export default function MonthlyReportPage() {
  const [user, setUser] = useState<{ role: string; brand_id: string | null } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingReport, setEditingReport] = useState<Partial<MonthlyReport> | null>(null);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [scorecard, setScorecard] = useState<ScorecardEntry[]>([]);
  const [weeksIncluded, setWeeksIncluded] = useState(0);
  const [narasi, setNarasi] = useState({ keberhasilan: '', kegagalan: '', insight_kompetitor: '', rencana_strategis: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const monthOptions = getMonthOptions(6);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { setUser(d.user); if (d.user?.brand_id) setSelectedBrand(d.user.brand_id); });
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
    fetch('/api/monthly-reports').then(r => r.json()).then(setReports);
  }, []);

  async function loadMonthData() {
    if (!selectedBrand || !selectedMonth) return;

    const weeklyRes = await fetch(`/api/weekly-reports?brand_id=${selectedBrand}`);
    const weeklyReports = await weeklyRes.json();

    const periods = getPeriodsForMonth(selectedMonth);
    const periodStarts = periods.map(p => p.week_start);

    const monthReports = weeklyReports.filter((r: { week_start: string; status: string }) => {
      const weekStart = r.week_start ? r.week_start.substring(0, 10) : '';
      return periodStarts.includes(weekStart) && r.status === 'submitted';
    });

    if (monthReports.length === 0) {
      alert('Tidak ada weekly report yang disubmit untuk bulan ini');
      return;
    }

    setWeeksIncluded(monthReports.length);

    // Load master KPI meta for aggregation mode / higher_is_better
    const itemsRes = await fetch(`/api/kpi-monitor/items?brand_id=${selectedBrand}&enabled_only=true`);
    const configs = await itemsRes.json();
    const metaByName: Record<string, { unit: string; auto_aggregation?: string; higher_is_better?: boolean }> = {};
    (Array.isArray(configs) ? configs : []).forEach((c: { kpi_name: string; kpi_item?: { unit?: string; auto_aggregation?: string; higher_is_better?: boolean } }) => {
      metaByName[c.kpi_name] = {
        unit: c.kpi_item?.unit || 'number',
        auto_aggregation: c.kpi_item?.auto_aggregation,
        higher_is_better: c.kpi_item?.higher_is_better !== false,
      };
    });

    const kpiMap: Record<string, { actuals: number[]; targets: number[]; unit: string; higher_is_better: boolean; auto_aggregation?: string }> = {};
    monthReports.forEach((r: { kpis: { kpi_name: string; unit: string; actual: string; target: string }[] }) => {
      (r.kpis || []).forEach((kpi) => {
        const meta = metaByName[kpi.kpi_name];
        if (!kpiMap[kpi.kpi_name]) {
          kpiMap[kpi.kpi_name] = {
            actuals: [],
            targets: [],
            unit: meta?.unit || kpi.unit || 'number',
            higher_is_better: meta?.higher_is_better !== false,
            auto_aggregation: meta?.auto_aggregation,
          };
        }
        if (hasWeekValue(kpi.actual)) kpiMap[kpi.kpi_name].actuals.push(parseNum(kpi.actual));
        if (hasWeekValue(kpi.target)) kpiMap[kpi.kpi_name].targets.push(parseNum(kpi.target));
      });
    });

    const entries: ScorecardEntry[] = Object.entries(kpiMap).map(([name, data]) => {
      const mode = getMonthlyAggMode(data.unit, name, data.auto_aggregation);
      const totalActual = rollupMonthlyValues(data.actuals, mode);
      const totalTarget = rollupMonthlyValues(data.targets, mode);
      const pct = calcPct(totalActual, totalTarget);
      const score = calcEffectivePct(totalActual, totalTarget, data.higher_is_better);
      return {
        kpi_name: name,
        unit: data.unit,
        actual_monthly: totalActual,
        target_monthly: totalTarget,
        pct,
        score,
        higher_is_better: data.higher_is_better,
        agg_mode: mode,
        weeks_included: Math.max(data.actuals.length, data.targets.length),
      };
    });

    setScorecard(entries);
  }

  function hasWeekValue(val: unknown): boolean {
    if (val === '' || val === null || val === undefined) return false;
    return true;
  }

  async function handleSave(status: 'draft' | 'submitted') {
    if (!selectedBrand || !selectedMonth) return;
    if (status === 'submitted' && scorecard.length === 0) {
      setToast('❌ Aggregate scorecard dulu sebelum submit');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setSaving(true);
    const brand = brands.find(b => b.id === selectedBrand);
    const monthData = monthOptions.find(m => m.month_year === selectedMonth);

    const res = await fetch('/api/monthly-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: selectedBrand,
        brand_name: brand?.name || '',
        month_label: monthData?.month_label || selectedMonth,
        month_year: selectedMonth,
        scorecard,
        ...narasi,
        status,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setToast(status === 'submitted' ? '✅ Monthly Report disubmit!' : '💾 Draft tersimpan');
      setTimeout(() => setToast(''), 3000);
      fetch('/api/monthly-reports').then(r => r.json()).then(setReports);
      if (status === 'submitted') setView('list');
    } else {
      const d = await res.json().catch(() => ({}));
      setToast(`❌ ${d.error || 'Gagal menyimpan'}`);
      setTimeout(() => setToast(''), 4000);
    }
  }

  function openEdit(r: MonthlyReport) {
    setSelectedBrand(r.brand_id);
    setSelectedMonth(r.month_year);
    setScorecard(r.scorecard || []);
    setWeeksIncluded(0);
    setNarasi({ keberhasilan: r.keberhasilan || '', kegagalan: r.kegagalan || '', insight_kompetitor: r.insight_kompetitor || '', rencana_strategis: r.rencana_strategis || '' });
    setEditingReport(r);
    setView('form');
  }

  function updateActual(i: number, num: number) {
    const entry = scorecard[i];
    const higher = entry.higher_is_better !== false;
    const pct = calcPct(num, entry.target_monthly);
    const score = calcEffectivePct(num, entry.target_monthly, higher);
    const n = [...scorecard];
    n[i] = { ...entry, actual_monthly: num, pct, score };
    setScorecard(n);
  }

  const STATUS_CLASS: Record<string, string> = { draft: 'status-behind', submitted: 'status-on-track', reviewed: 'status-achieved' };

  async function handleReview(id: string, next: 'reviewed' | 'submitted') {
    const res = await fetch('/api/monthly-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    if (res.ok) {
      setToast(next === 'reviewed' ? '✅ Ditandai reviewed' : '↩️ Status dikembalikan');
      setTimeout(() => setToast(''), 3000);
      fetch('/api/monthly-reports').then(r => r.json()).then(setReports);
    }
  }

  if (view === 'form') {
    const overallScore = scorecard.length > 0 ? Math.round(scorecard.reduce((a, b) => a + b.score, 0) / scorecard.length) : 0;
    const brandOptions = user && !['owner', 'admin'].includes(user.role) && user.brand_id
      ? brands.filter(b => b.id === user.brand_id)
      : brands;

    return (
      <div style={{ maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}>← Kembali</button>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{editingReport ? 'Edit' : 'Buat'} Monthly Report</h1>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 1: Pilih Brand & Bulan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Brand</label>
              <select className="input" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}>
                {brandOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Bulan</label>
              <select className="input" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                <option value="">Pilih bulan...</option>
                {monthOptions.map(m => <option key={m.month_year} value={m.month_year}>{m.month_label}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={loadMonthData}>🔄 Auto-aggregate dari Weekly Reports</button>
          {weeksIncluded > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              📦 {weeksIncluded} dari 4 weekly report submitted dihitung · sum untuk omzet/spend, avg untuk ROAS/rating
            </div>
          )}
        </div>

        {scorecard.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Step 2: Monthly Scorecard</h3>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: overallScore >= 100 ? '#10B981' : overallScore >= 70 ? '#22C55E' : overallScore >= 50 ? '#F59E0B' : '#EF4444' }}>{overallScore}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overall Score (effective)</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>KPI</th>
                    <th style={{ width: '18%' }}>Target Bulanan</th>
                    <th style={{ width: '22%' }}>Aktual Bulanan</th>
                    <th style={{ width: '24%' }}>Pencapaian</th>
                    <th style={{ width: '14%' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecard.map((entry, i) => {
                    const scoreColor = entry.score >= 100 ? '#10B981' : entry.score >= 70 ? '#22C55E' : entry.score >= 50 ? '#F59E0B' : '#EF4444';
                    return (
                      <tr key={entry.kpi_name}>
                        <td style={{ fontWeight: 500, wordBreak: 'break-word' }}>
                          {entry.kpi_name}
                          {entry.agg_mode && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entry.agg_mode === 'avg' ? 'avg minggu' : 'sum minggu'}</div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatNum(entry.target_monthly, entry.unit)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            {entry.unit === 'currency' && (
                              <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>Rp</span>
                            )}
                            <input
                              className="input"
                              type="text"
                              inputMode="decimal"
                              value={formatIdInput(entry.actual_monthly)}
                              style={{ width: '100%', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
                              onChange={e => {
                                const raw = e.target.value;
                                if (raw !== '' && !/^[\d.,\s]*$/.test(raw)) return;
                                updateActual(i, parseNum(raw));
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 48, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ height: '100%', width: `${Math.min(entry.score, 100)}%`, background: scoreColor, borderRadius: 3 }} />
                            </div>
                            <span className={`badge ${getKpiStatusClass(entry.score)}`} style={{ fontSize: 9 }}>{entry.pct}%</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: scoreColor }}>{entry.score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 3: Analisis Bulanan</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { key: 'keberhasilan', label: '🏆 Keberhasilan Terbesar Bulan Ini' },
              { key: 'kegagalan', label: '⚠️ Kegagalan & Pelajaran' },
              { key: 'insight_kompetitor', label: '🔭 Insight Kompetitor' },
              { key: 'rencana_strategis', label: '🎯 Rencana Strategis Bulan Depan' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{field.label}</label>
                <textarea className="input" rows={4} value={narasi[field.key as keyof typeof narasi]} onChange={e => setNarasi(p => ({ ...p, [field.key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>💾 Simpan Draft</button>
          <button className="btn btn-primary" onClick={() => handleSave('submitted')} disabled={saving}>✅ Submit Monthly Report</button>
        </div>
        {toast && <div className="toast toast-success">{toast}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Monthly Report</h1>
        <button className="btn btn-primary" onClick={() => { setScorecard([]); setWeeksIncluded(0); setNarasi({ keberhasilan: '', kegagalan: '', insight_kompetitor: '', rencana_strategis: '' }); setEditingReport(null); setView('form'); }}>+ Buat Monthly Report</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Bulan</th><th>Brand</th><th>Rata-rata Score</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Belum ada monthly report</td></tr>
            ) : reports.map(r => {
              const avgScore = r.scorecard?.length > 0 ? Math.round(r.scorecard.reduce((a: number, b: { score: number }) => a + b.score, 0) / r.scorecard.length) : 0;
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.month_label}</td>
                  <td>{r.brand_name}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: avgScore >= 100 ? '#10B981' : avgScore >= 70 ? '#22C55E' : avgScore >= 50 ? '#F59E0B' : '#EF4444', fontSize: 15 }}>{avgScore}%</span>
                  </td>
                  <td><span className={`badge ${STATUS_CLASS[r.status]}`}>{r.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                      {user && ['owner', 'admin'].includes(user.role) && r.status === 'submitted' && (
                        <button className="btn btn-ghost btn-sm" style={{ color: '#10B981' }} onClick={() => handleReview(r.id, 'reviewed')}>Review ✓</button>
                      )}
                      {user && ['owner', 'admin'].includes(user.role) && r.status === 'reviewed' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleReview(r.id, 'submitted')}>Unreview</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
