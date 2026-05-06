'use client';

import { useState, useEffect } from 'react';
import { getMonthOptions, getPeriodsForMonth, formatNum, calcPct, getKpiStatusClass } from '@/lib/utils';

interface MonthlyReport { id: string; brand_id: string; brand_name: string; month_label: string; month_year: string; status: string; scorecard: ScorecardEntry[]; keberhasilan: string; kegagalan: string; insight_kompetitor: string; rencana_strategis: string; submitted_by: string; }
interface ScorecardEntry { kpi_name: string; unit: string; actual_monthly: number; target_monthly: number; pct: number; score: number; }
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

    // Fetch weekly reports for this brand
    const weeklyRes = await fetch(`/api/weekly-reports?brand_id=${selectedBrand}`);
    const weeklyReports = await weeklyRes.json();

    // Get the 4 fixed periods for this month (1-7, 8-14, 15-21, 22-end)
    const periods = getPeriodsForMonth(selectedMonth);
    const periodStarts = periods.map(p => p.week_start); // e.g. ['2026-05-01','2026-05-08','2026-05-15','2026-05-22']

    // Filter reports that match any of the 4 period start dates for this month
    const monthReports = weeklyReports.filter((r: { week_start: string; status: string }) => {
      const weekStart = r.week_start ? r.week_start.substring(0, 10) : '';
      return periodStarts.includes(weekStart) && r.status === 'submitted';
    });

    if (monthReports.length === 0) {
      alert('Tidak ada weekly report yang disubmit untuk bulan ini');
      return;
    }

    // Aggregate KPIs
    const kpiMap: Record<string, { actuals: number[]; targets: number[]; unit: string }> = {};
    monthReports.forEach((r: { kpis: { kpi_name: string; unit: string; actual: string; target: string }[] }) => {
      (r.kpis || []).forEach((kpi: { kpi_name: string; unit: string; actual: string; target: string }) => {
        if (!kpiMap[kpi.kpi_name]) kpiMap[kpi.kpi_name] = { actuals: [], targets: [], unit: kpi.unit };
        kpiMap[kpi.kpi_name].actuals.push(parseFloat(kpi.actual || '0'));
        kpiMap[kpi.kpi_name].targets.push(parseFloat(kpi.target || '0'));
      });
    });

    const entries: ScorecardEntry[] = Object.entries(kpiMap).map(([name, data]) => {
      const totalActual = data.actuals.reduce((a, b) => a + b, 0);
      const totalTarget = data.targets.reduce((a, b) => a + b, 0);
      const pct = calcPct(totalActual, totalTarget);
      return { kpi_name: name, unit: data.unit, actual_monthly: totalActual, target_monthly: totalTarget, pct, score: Math.min(pct, 100) };
    });

    setScorecard(entries);
  }

  async function handleSave(status: 'draft' | 'submitted') {
    if (!selectedBrand || !selectedMonth) return;
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
    }
  }

  function openEdit(r: MonthlyReport) {
    setSelectedBrand(r.brand_id);
    setSelectedMonth(r.month_year);
    setScorecard(r.scorecard || []);
    setNarasi({ keberhasilan: r.keberhasilan || '', kegagalan: r.kegagalan || '', insight_kompetitor: r.insight_kompetitor || '', rencana_strategis: r.rencana_strategis || '' });
    setEditingReport(r);
    setView('form');
  }

  const STATUS_CLASS: Record<string, string> = { draft: 'status-behind', submitted: 'status-on-track', reviewed: 'status-achieved' };

  if (view === 'form') {
    const overallScore = scorecard.length > 0 ? Math.round(scorecard.reduce((a, b) => a + b.score, 0) / scorecard.length) : 0;

    return (
      <div style={{ maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}>← Kembali</button>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{editingReport ? 'Edit' : 'Buat'} Monthly Report</h1>
        </div>

        {/* Brand & Month */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 1: Pilih Brand & Bulan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Brand</label>
              <select className="input" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
        </div>

        {/* Scorecard */}
        {scorecard.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Step 2: Monthly Scorecard</h3>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: overallScore >= 100 ? '#10B981' : overallScore >= 70 ? '#22C55E' : overallScore >= 50 ? '#F59E0B' : '#EF4444' }}>{overallScore}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overall Score</div>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr><th>KPI</th><th>Target Bulanan</th><th>Aktual Bulanan</th><th>Pencapaian</th><th>Score</th></tr>
              </thead>
              <tbody>
                {scorecard.map((entry, i) => (
                  <tr key={entry.kpi_name}>
                    <td style={{ fontWeight: 500 }}>{entry.kpi_name}</td>
                    <td>{formatNum(entry.target_monthly, entry.unit)}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={entry.actual_monthly}
                        style={{ maxWidth: 120 }}
                        onChange={e => {
                          const n = [...scorecard];
                          n[i] = { ...entry, actual_monthly: parseFloat(e.target.value || '0'), pct: calcPct(parseFloat(e.target.value || '0'), entry.target_monthly), score: Math.min(calcPct(parseFloat(e.target.value || '0'), entry.target_monthly), 100) };
                          setScorecard(n);
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(entry.pct, 100)}%`, background: entry.pct >= 100 ? '#10B981' : entry.pct >= 70 ? '#22C55E' : entry.pct >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
                        </div>
                        <span className={`badge ${getKpiStatusClass(entry.pct)}`} style={{ fontSize: 9 }}>{entry.pct}%</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: entry.score >= 100 ? '#10B981' : entry.score >= 70 ? '#22C55E' : '#EF4444' }}>{entry.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Narasi */}
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
        <button className="btn btn-primary" onClick={() => { setScorecard([]); setNarasi({ keberhasilan: '', kegagalan: '', insight_kompetitor: '', rencana_strategis: '' }); setEditingReport(null); setView('form'); }}>+ Buat Monthly Report</button>
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
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
