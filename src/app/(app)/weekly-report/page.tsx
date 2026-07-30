'use client';

import { useState, useEffect } from 'react';
import {
  getWeekOptions,
  formatNum,
  formatIdInput,
  parseNum,
  formatDateShort,
  calcPct,
  calcEffectivePct,
  getKpiStatusClass,
  aggregateKpi,
  parseAutoSumConfig,
  selectAutoSumSources,
  sumAutoSumActuals,
  createActionItem,
  normalizeActionItems,
  type ActionItem,
} from '@/lib/utils';

interface KpiEntry {
  kpi_item_id: string;
  kpi_name: string;
  unit: string;
  category: string;
  target: string;
  actual: string;
  pct: number;
  score?: number;
  notes: string;
  is_auto: boolean;
  is_overridden: boolean;
  higher_is_better?: boolean;
  auto_source_role?: string | null;
  auto_sum_platform?: string | null;
}
interface WeeklyReport {
  id: string;
  brand_id: string;
  brand_name: string;
  week_label: string;
  week_start: string;
  status: string;
  kpis: KpiEntry[];
  highlights: string;
  lowlights: string;
  root_cause: string;
  action_plan: string;
  eskalasi: string;
  action_items?: ActionItem[];
  submitted_by: string;
  reviewed_by?: string | null;
}
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
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [prevActions, setPrevActions] = useState<ActionItem[]>([]);
  const [prevWeekLabel, setPrevWeekLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const weekOptions = getWeekOptions(6);

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

  useEffect(() => {
    if (view === 'form' && selectedBrand && selectedWeek) {
      loadPrevActions(selectedBrand, selectedWeek);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, selectedWeek, view]);

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

    type ConfigRow = {
      kpi_item_id: string;
      kpi_name: string;
      kpi_item: {
        unit: string;
        category: string;
        auto_source: string;
        auto_source_role: string | null;
        auto_aggregation: string;
        platform?: string | null;
        higher_is_better?: boolean;
      };
    };

    const standupRows = (standups as { session: string; user_role: string; standup_date: string; status: string; daily_log: Record<string, unknown> }[]).map((s) => ({
      ...s,
      session: s.session || 'sore',
      status: s.status || 'submitted',
      daily_log: s.daily_log || {},
    }));

    // Auto-aggregate daily_log KPIs via shared aggregateKpi (parseNum + skip empty)
    const entries: KpiEntry[] = (configs as ConfigRow[]).map((c) => {
      const target = targets.find((t: { kpi_item_id: string; target_value: number }) => t.kpi_item_id === c.kpi_item_id);
      let actual = '';
      let isAuto = false;

      if (c.kpi_item.category === 'auto_daily_log') {
        const val = aggregateKpi(standupRows, c.kpi_item, weekData.week_start, weekData.week_end);
        if (val !== null) {
          actual = String(val);
          isAuto = true;
        }
      }

      const higherIsBetter = c.kpi_item.higher_is_better !== false;
      const targetVal = target ? target.target_value : 0;
      const actualNum = parseNum(actual);
      const pct = target ? calcPct(actualNum, targetVal) : 0;
      const score = target ? calcEffectivePct(actualNum, targetVal, higherIsBetter) : 0;

      return {
        kpi_item_id: c.kpi_item_id,
        kpi_name: c.kpi_name,
        unit: c.kpi_item.unit,
        category: c.kpi_item.category,
        target: target ? String(target.target_value) : '',
        actual,
        pct,
        score,
        notes: '',
        is_auto: isAuto,
        is_overridden: false,
        higher_is_better: higherIsBetter,
        auto_source_role: c.kpi_item.auto_source_role,
        auto_sum_platform: c.kpi_item.platform ?? null,
      };
    });

    // auto_sum via shared selectAutoSumSources (same rules as KPI Monitor)
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.category !== 'auto_sum') continue;
      const sumConfig = parseAutoSumConfig(entry.auto_sum_platform, entry.auto_source_role);
      const sourceMeta = selectAutoSumSources(
        entries.map((e) => ({
          kpi_item_id: e.kpi_item_id,
          kpi_name: e.kpi_name,
          unit: e.unit,
          category: e.category,
          auto_source_role: e.auto_source_role,
        })),
        sumConfig
      );
      const sourceIds = new Set(sourceMeta.map((s) => s.kpi_item_id));
      const sourceRows = entries.filter((e) => sourceIds.has(e.kpi_item_id));
      const total = sumAutoSumActuals(sourceRows);
      const higher = entry.higher_is_better !== false;
      const targetVal = parseNum(entry.target);
      entries[i] = {
        ...entry,
        actual: String(total),
        pct: calcPct(total, targetVal),
        score: calcEffectivePct(total, targetVal, higher),
        is_auto: true,
      };
    }

    setKpiData(entries);
    await loadPrevActions(selectedBrand, selectedWeek);
  }

  async function loadPrevActions(brandId: string, weekLabel: string) {
    const idx = weekOptions.findIndex((w) => w.week_label === weekLabel);
    const prev = idx >= 0 ? weekOptions[idx + 1] : null;
    if (!prev || !brandId) {
      setPrevActions([]);
      setPrevWeekLabel('');
      return;
    }
    setPrevWeekLabel(prev.week_label);
    try {
      const res = await fetch(`/api/weekly-reports?brand_id=${brandId}&week_label=${encodeURIComponent(prev.week_label)}`);
      const list = await res.json();
      const prevReport = Array.isArray(list) ? list[0] : null;
      setPrevActions(normalizeActionItems(prevReport?.action_items));
    } catch {
      setPrevActions([]);
    }
  }

  function openCreate() {
    const defaultWeek = weekOptions[0];
    setSelectedWeek(defaultWeek.week_label);
    setKpiData([]);
    setNarasi({ highlights: '', lowlights: '', root_cause: '', action_plan: '', eskalasi: '' });
    setActionItems([]);
    setPrevActions([]);
    setPrevWeekLabel('');
    setEditingReport(null);
    setView('form');
    if (selectedBrand && defaultWeek) loadPrevActions(selectedBrand, defaultWeek.week_label);
  }

  function openEdit(report: WeeklyReport) {
    setSelectedBrand(report.brand_id);
    setSelectedWeek(report.week_label);
    setKpiData(report.kpis || []);
    setNarasi({ highlights: report.highlights || '', lowlights: report.lowlights || '', root_cause: report.root_cause || '', action_plan: report.action_plan || '', eskalasi: report.eskalasi || '' });
    setActionItems(normalizeActionItems(report.action_items));
    setEditingReport(report);
    setView('form');
    loadPrevActions(report.brand_id, report.week_label);
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin hapus Weekly Report ini? Aksi tidak bisa dibatalkan.')) return;
    const res = await fetch(`/api/weekly-reports?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setToast('✅ Weekly Report berhasil dihapus');
      setTimeout(() => setToast(''), 3000);
      fetch('/api/weekly-reports').then(r => r.json()).then(setReports);
    } else {
      const d = await res.json();
      setToast(`❌ ${d.error || 'Gagal menghapus'}`);
      setTimeout(() => setToast(''), 3000);
    }
    setDeletingId(null);
  }

  async function handleSave(status: 'draft' | 'submitted') {
    if (!selectedBrand || !selectedWeek) return;
    if (status === 'submitted' && kpiData.length === 0) {
      setToast('❌ Load data KPI dulu sebelum submit');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    if (status === 'submitted') {
      const behind = kpiData.filter((k) => (k.score ?? k.pct) < 70 && parseNum(k.target) > 0);
      if (behind.length > 0) {
        if (!narasi.root_cause.trim()) {
          setToast(`❌ ${behind.length} KPI di bawah 70% — isi Root Cause`);
          setTimeout(() => setToast(''), 4000);
          return;
        }
        if (!actionItems.some((a) => a.title.trim() && a.owner.trim())) {
          setToast('❌ Minimal 1 Action Item (judul + PIC) karena ada KPI behind');
          setTimeout(() => setToast(''), 4000);
          return;
        }
      }
    }
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
      action_items: actionItems,
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
      setToast(status === 'submitted' ? '✅ Weekly Report disubmit! Angka Monitor jadi Frozen.' : '💾 Draft tersimpan');
      setTimeout(() => setToast(''), 3000);
      fetch('/api/weekly-reports').then(r => r.json()).then(setReports);
      if (status === 'submitted') setView('list');
    } else {
      const d = await res.json().catch(() => ({}));
      setToast(`❌ ${d.error || 'Gagal menyimpan'}`);
      setTimeout(() => setToast(''), 4000);
    }
  }

  async function handleReview(id: string, next: 'reviewed' | 'submitted') {
    const res = await fetch('/api/weekly-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    if (res.ok) {
      setToast(next === 'reviewed' ? '✅ Ditandai reviewed' : '↩️ Status dikembalikan ke submitted');
      setTimeout(() => setToast(''), 3000);
      fetch('/api/weekly-reports').then(r => r.json()).then(setReports);
    } else {
      const d = await res.json().catch(() => ({}));
      setToast(`❌ ${d.error || 'Gagal review'}`);
      setTimeout(() => setToast(''), 3000);
    }
  }

  const STATUS_CLASS: Record<string, string> = { draft: 'status-behind', submitted: 'status-on-track', reviewed: 'status-achieved' };

  if (view === 'form') {
    const brandOptions = user && !['owner', 'admin'].includes(user.role) && user.brand_id
      ? brands.filter(b => b.id === user.brand_id)
      : brands;

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
                {brandOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
              <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>KPI</th>
                    <th style={{ width: '18%' }}>Target</th>
                    <th style={{ width: '22%' }}>Aktual</th>
                    <th style={{ width: '14%' }}>Pencapaian</th>
                    <th style={{ width: '26%' }}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiData.map((kpi, i) => (
                    <tr key={kpi.kpi_item_id}>
                      <td style={{ wordBreak: 'break-word' }}>{kpi.kpi_name}<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{kpi.unit}</span></td>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{kpi.target ? formatNum(parseNum(kpi.target), kpi.unit) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {kpi.unit === 'currency' && (
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>Rp</span>
                          )}
                          <input
                            className="input"
                            type="text"
                            inputMode="decimal"
                            value={formatIdInput(kpi.actual)}
                            style={{ width: '100%', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}
                            readOnly={kpi.category === 'auto_sum'}
                            onChange={e => {
                              if (kpi.category === 'auto_sum') return;
                              const raw = e.target.value;
                              if (raw !== '' && !/^[\d.,\s]*$/.test(raw)) return;
                              const num = parseNum(raw);
                              const stored = raw.trim() === '' ? '' : String(num);
                              const higher = kpi.higher_is_better !== false;
                              const targetVal = parseNum(kpi.target);
                              const newKpis = [...kpiData];
                              newKpis[i] = {
                                ...kpi,
                                actual: stored,
                                pct: calcPct(num, targetVal),
                                score: calcEffectivePct(num, targetVal, higher),
                                is_overridden: kpi.is_auto,
                              };
                              for (let j = 0; j < newKpis.length; j++) {
                                if (newKpis[j].category !== 'auto_sum') continue;
                                const sumConfig = parseAutoSumConfig(newKpis[j].auto_sum_platform, newKpis[j].auto_source_role);
                                const sourceMeta = selectAutoSumSources(
                                  newKpis.map((e) => ({
                                    kpi_item_id: e.kpi_item_id,
                                    kpi_name: e.kpi_name,
                                    unit: e.unit,
                                    category: e.category,
                                    auto_source_role: e.auto_source_role,
                                  })),
                                  sumConfig
                                );
                                const sourceIds = new Set(sourceMeta.map((s) => s.kpi_item_id));
                                const total = sumAutoSumActuals(newKpis.filter((e) => sourceIds.has(e.kpi_item_id)));
                                const tVal = parseNum(newKpis[j].target);
                                const h = newKpis[j].higher_is_better !== false;
                                newKpis[j] = {
                                  ...newKpis[j],
                                  actual: String(total),
                                  pct: calcPct(total, tVal),
                                  score: calcEffectivePct(total, tVal, h),
                                };
                              }
                              setKpiData(newKpis);
                            }}
                          />
                          {kpi.is_auto && !kpi.is_overridden && <span style={{ fontSize: 10, color: 'var(--blue)', flexShrink: 0 }}>🔄Auto</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge ${getKpiStatusClass(kpi.score ?? kpi.pct)}`}>{kpi.pct}%</span>
                        </div>
                      </td>
                      <td>
                        <input className="input" type="text" placeholder="Catatan..." value={kpi.notes}
                          style={{ width: '100%' }}
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

        {/* Step 3: Action minggu lalu (check-in) */}
        {prevActions.length > 0 && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(245,158,11,0.35)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Step 3: Action Minggu Lalu</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Cek dulu komitmen dari {prevWeekLabel} sebelum bikin action baru.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {prevActions.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span className={`badge ${a.status === 'done' ? 'status-achieved' : a.status === 'blocked' ? 'status-behind' : 'status-at-risk'}`}>{a.status}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{a.title || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PIC: {a.owner || '—'} · Due: {a.due_date || '—'}{a.kpi_name ? ` · ${a.kpi_name}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Action items minggu ini */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Step 4: Action Items Minggu Depan</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionItems((p) => [...p, createActionItem()])}>+ Tambah</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Max 3 action ideal. Wajib jika ada KPI score &lt; 70%.</p>
          {actionItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 12 }}>Belum ada action item.</div>
          ) : actionItems.map((item, i) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <input className="input" placeholder="Apa yang dikerjakan?" value={item.title} onChange={(e) => {
                const n = [...actionItems]; n[i] = { ...item, title: e.target.value }; setActionItems(n);
              }} />
              <input className="input" placeholder="PIC" value={item.owner} onChange={(e) => {
                const n = [...actionItems]; n[i] = { ...item, owner: e.target.value }; setActionItems(n);
              }} />
              <input className="input" type="date" value={item.due_date} onChange={(e) => {
                const n = [...actionItems]; n[i] = { ...item, due_date: e.target.value }; setActionItems(n);
              }} />
              <select className="input" value={item.status} onChange={(e) => {
                const n = [...actionItems]; n[i] = { ...item, status: e.target.value as ActionItem['status'] }; setActionItems(n);
              }}>
                <option value="open">open</option>
                <option value="done">done</option>
                <option value="blocked">blocked</option>
              </select>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#EF4444' }} onClick={() => setActionItems((p) => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>

        {/* Step 5: Narasi */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Step 5: Narasi</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { key: 'highlights', label: '✨ Highlights — Pencapaian Terbaik Minggu Ini' },
              { key: 'lowlights', label: '⚠️ Lowlights — Masalah / Kekurangan' },
              { key: 'root_cause', label: '🔍 Root Cause — Wajib jika ada KPI score < 70%' },
              { key: 'action_plan', label: '📋 Action Plan (narasi bebas, opsional)' },
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
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                    {user && ['owner', 'admin'].includes(user.role) && r.status === 'submitted' && (
                      <button className="btn btn-ghost btn-sm" style={{ color: '#10B981' }} onClick={() => handleReview(r.id, 'reviewed')}>Review ✓</button>
                    )}
                    {user && ['owner', 'admin'].includes(user.role) && r.status === 'reviewed' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleReview(r.id, 'submitted')}>Unreview</button>
                    )}
                    {user && ['owner', 'admin', 'brand_manager'].includes(user.role) && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#EF4444' }}
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                      >
                        🗑 Hapus
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
