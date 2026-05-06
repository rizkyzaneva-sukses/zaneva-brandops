'use client';

import { useState, useEffect } from 'react';
import { getWeekOptions, formatNum, formatDateShort, calcPct, getKpiStatusClass } from '@/lib/utils';

interface KpiEntry { kpi_item_id: string; kpi_name: string; unit: string; category: string; target: string; actual: string; pct: number; notes: string; is_auto: boolean; is_overridden: boolean; }
interface WeeklyReport { id: string; brand_id: string; brand_name: string; week_label: string; week_start: string; status: string; kpis: KpiEntry[]; highlights: string; lowlights: string; root_cause: string; action_plan: string; eskalasi: string; submitted_by: string; }
interface Brand { id: string; name: string; }

export default function WeeklyReportPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [user, setUser] = useState<{ role: string; brand_id: string | null; full_name: string } | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingReport, setEditingReport] = useState<Partial<WeeklyReport> | null>(null);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [kpiData, setKpiData] = useState<KpiEntry[]>([]);
  const [narasi, setNarasi] = useState({ highlights: '', lowlights: '', root_cause: '', action_plan: '', eskalasi: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const weekOptions = getWeekOptions(2);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUser(d.user);
      if (d.user?.brand_id) setSelectedBrand(d.user.brand_id);
    });
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
  }, []);

  useEffect(() => {
    const brandFilter = user?.brand_id || '';
    if (!brandFilter && user && !['owner', 'admin'].includes(user.role)) return;
    fetch(`/api/weekly-reports${brandFilter && user && !['owner', 'admin'].includes(user.role) ? `?brand_id=${brandFilter}` : ''}`)
      .then(r => r.json()).then(setReports);
  }, [user]);

  async function loadWeekData() {
    if (!selectedBrand || !selectedWeek) return;
    const weekData = weekOptions.find(w => w.week_label === selectedWeek);
    if (!weekData) return;

    // Load KPI configs
    const [configsRes, targetsRes, standupRes] = await Promise.all([
      fetch(`/api/kpi-monitor/items?brand_id=${selectedBrand}&enabled_only=true`),
      fetch(`/api/kpi-targets?brand_id=${selectedBrand}&week_label=${encodeURIComponent(selectedWeek)}`),
      fetch(`/api/standups?brand_id=${selectedBrand}&date_from=${weekData.week_start}&date_to=${weekData.week_end}&session=sore&status=submitted`),
    ]);
    const configs = await configsRes.json();
    const targets = await targetsRes.json();
    const standups = await standupRes.json();

    // Auto-aggregate
    const entries: KpiEntry[] = configs.map((c: { kpi_item_id: string; kpi_name: string; kpi_item: { unit: string; category: string; auto_source: string; auto_source_role: string; auto_aggregation: string } }) => {
      const target = targets.find((t: { kpi_item_id: string; target_value: number }) => t.kpi_item_id === c.kpi_item_id);
      let actual = '';
      let isAuto = false;

      if (c.kpi_item.category === 'auto_daily_log') {
        const filtered = standups.filter((s: { user_role: string; daily_log: Record<string, unknown> }) => s.user_role === c.kpi_item.auto_source_role);
        const vals = filtered.map((s: { daily_log: Record<string, unknown> }) => parseFloat(String(s.daily_log?.[c.kpi_item.auto_source] || '0'))).filter((v: number) => !isNaN(v));
        if (vals.length > 0) {
          const sum = vals.reduce((a: number, b: number) => a + b, 0);
          actual = String(c.kpi_item.auto_aggregation === 'avg' ? sum / vals.length : sum);
          isAuto = true;
        }
      }

      return {
        kpi_item_id: c.kpi_item_id,
        kpi_name: c.kpi_name,
        unit: c.kpi_item.unit,
        category: c.kpi_item.category,
        target: target ? String(target.target_value) : '',
        actual,
        pct: target ? calcPct(parseFloat(actual || '0'), target.target_value) : 0,
        notes: '',
        is_auto: isAuto,
        is_overridden: false,
      };
    });

    // Calculate auto_sum KPIs based on formula config stored in platform field
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.category === 'auto_sum') {
        const config = configs.find((cfg: any) => cfg.kpi_item_id === entry.kpi_item_id);
        let formulaConfig: { formula?: string; kpi_names?: string } = { formula: 'all_currency' };
        try {
          if (config?.kpi_item?.platform) formulaConfig = JSON.parse(config.kpi_item.platform);
        } catch { }

        let sourceKpis: typeof entries = [];
        const formula = formulaConfig.formula || 'all_currency';

        if (formula === 'all_currency') {
          sourceKpis = entries.filter(e => e.category === 'auto_daily_log' && e.unit === 'currency');
        } else if (formula === 'all_number') {
          sourceKpis = entries.filter(e => e.category === 'auto_daily_log' && e.unit === 'number');
        } else if (formula === 'by_role') {
          const targetRole = config?.kpi_item?.auto_source_role || '';
          sourceKpis = entries.filter(e => e.category === 'auto_daily_log');
          // Filter by role: check if the source config matches
          if (targetRole) {
            const roleConfigs = configs.filter((cfg: any) => cfg.kpi_item?.auto_source_role === targetRole && cfg.kpi_item?.category === 'auto_daily_log');
            const roleKpiIds = new Set(roleConfigs.map((cfg: any) => cfg.kpi_item_id));
            sourceKpis = entries.filter(e => roleKpiIds.has(e.kpi_item_id));
          }
        } else if (formula === 'custom') {
          const kpiNames = (formulaConfig.kpi_names || '').split(',').map((n: string) => n.trim().toLowerCase()).filter(Boolean);
          sourceKpis = entries.filter(e => kpiNames.includes(e.kpi_name.toLowerCase()));
        } else {
          // Fallback: all currency auto_daily_log
          sourceKpis = entries.filter(e => e.category === 'auto_daily_log' && e.unit === 'currency');
        }

        const total = sourceKpis.reduce((sum, k) => sum + parseFloat(k.actual || '0'), 0);
        entries[i] = { ...entry, actual: String(total), pct: calcPct(total, parseFloat(entry.target || '0')), is_auto: true };
      }
    }

    setKpiData(entries);
  }

  function openCreate() {
    const defaultWeek = weekOptions[0];
    setSelectedWeek(defaultWeek.week_label);
    setKpiData([]);
    setNarasi({ highlights: '', lowlights: '', root_cause: '', action_plan: '', eskalasi: '' });
    setEditingReport(null);
    setView('form');
  }

  function openEdit(report: WeeklyReport) {
    setSelectedBrand(report.brand_id);
    setSelectedWeek(report.week_label);
    setKpiData(report.kpis || []);
    setNarasi({ highlights: report.highlights || '', lowlights: report.lowlights || '', root_cause: report.root_cause || '', action_plan: report.action_plan || '', eskalasi: report.eskalasi || '' });
    setEditingReport(report);
    setView('form');
  }

  async function handleSave(status: 'draft' | 'submitted') {
    if (!selectedBrand || !selectedWeek) return;
    setSaving(true);
    const weekData = weekOptions.find(w => w.week_label === selectedWeek);
    const brand = brands.find(b => b.id === selectedBrand);

    const payload = {
      brand_id: selectedBrand,
      brand_name: brand?.name || '',
      week_label: selectedWeek,
      week_start: weekData?.week_start,
      week_end: weekData?.week_end,
      kpis: kpiData,
      ...narasi,
      status,
    };

    const res = await fetch('/api/weekly-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setToast(status === 'submitted' ? '✅ Weekly Report disubmit!' : '💾 Draft tersimpan');
      setTimeout(() => setToast(''), 3000);
      fetch('/api/weekly-reports').then(r => r.json()).then(setReports);
      if (status === 'submitted') setView('list');
    }
  }

  const STATUS_CLASS: Record<string, string> = { draft: 'status-behind', submitted: 'status-on-track', reviewed: 'status-achieved' };

  if (view === 'form') {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}>← Kembali</button>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{editingReport ? 'Edit' : 'Buat'} Weekly Report</h1>
        </div>

        {/* Step 1: Brand & Week */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 1: Pilih Brand & Minggu</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Brand</label>
              <select className="input" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Minggu</label>
              <select className="input" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                {weekOptions.map(w => <option key={w.week_label} value={w.week_label}>{w.week_label}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={loadWeekData}>🔄 Load Data Otomatis</button>
        </div>

        {/* Step 2: KPI Table */}
        {kpiData.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 2: Tabel KPI</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Target</th>
                    <th>Aktual</th>
                    <th>Pencapaian</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiData.map((kpi, i) => (
                    <tr key={kpi.kpi_item_id}>
                      <td>{kpi.kpi_name}<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{kpi.unit}</span></td>
                      <td>{kpi.target ? formatNum(parseFloat(kpi.target), kpi.unit) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            className="input"
                            type="number"
                            value={kpi.actual}
                            style={{ maxWidth: 120 }}
                            readOnly={kpi.category === 'auto_sum'}
                            onChange={e => {
                              if (kpi.category === 'auto_sum') return;
                              const newKpis = [...kpiData];
                              newKpis[i] = { ...kpi, actual: e.target.value, pct: calcPct(parseFloat(e.target.value || '0'), parseFloat(kpi.target || '0')), is_overridden: kpi.is_auto };
                              // Recalculate all auto_sum KPIs whenever any value changes
                              for (let j = 0; j < newKpis.length; j++) {
                                if (newKpis[j].category === 'auto_sum') {
                                  // Simple recalc: sum all non-auto_sum entries that are auto_daily_log with currency
                                  const sourceKpis = newKpis.filter(ek => ek.category === 'auto_daily_log' && ek.unit === 'currency');
                                  const total = sourceKpis.reduce((sum, k) => sum + parseFloat(k.actual || '0'), 0);
                                  newKpis[j] = { ...newKpis[j], actual: String(total), pct: calcPct(total, parseFloat(newKpis[j].target || '0')) };
                                }
                              }
                              setKpiData(newKpis);
                            }}
                          />
                          {kpi.is_auto && !kpi.is_overridden && <span style={{ fontSize: 10, color: 'var(--blue)' }}>🔄Auto</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge ${getKpiStatusClass(kpi.pct)}`}>{kpi.pct}%</span>
                        </div>
                      </td>
                      <td>
                        <input className="input" type="text" placeholder="Catatan..." value={kpi.notes}
                          onChange={e => { const n = [...kpiData]; n[i] = { ...kpi, notes: e.target.value }; setKpiData(n); }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 3: Narasi */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 3: Narasi</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { key: 'highlights', label: '✨ Highlights — Pencapaian Terbaik Minggu Ini' },
              { key: 'lowlights', label: '⚠️ Lowlights — Masalah / Kekurangan' },
              { key: 'root_cause', label: '🔍 Root Cause — Analisis Akar Masalah' },
              { key: 'action_plan', label: '📋 Action Plan — Rencana Minggu Depan' },
              { key: 'eskalasi', label: '🚨 Eskalasi ke Owner (opsional)' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{field.label}</label>
                <textarea
                  className="input"
                  rows={3}
                  value={narasi[field.key as keyof typeof narasi]}
                  onChange={e => setNarasi(p => ({ ...p, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>💾 Simpan Draft</button>
          <button className="btn btn-primary" onClick={() => handleSave('submitted')} disabled={saving}>✅ Submit Weekly Report</button>
        </div>

        {toast && <div className="toast toast-success">{toast}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Weekly Report</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Buat Weekly Report</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Minggu</th><th>Brand</th><th>Status</th><th>Disubmit Oleh</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Belum ada weekly report</td></tr>
            ) : reports.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.week_label}</td>
                <td>{r.brand_name}</td>
                <td><span className={`badge ${STATUS_CLASS[r.status]}`}>{r.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.submitted_by || '—'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
