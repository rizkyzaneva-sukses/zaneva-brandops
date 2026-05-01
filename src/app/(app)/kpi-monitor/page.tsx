'use client';

import { useState, useEffect } from 'react';
import { getCurrentWeek, formatNum, getKpiStatusClass, formatDateShort } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface KpiData {
  kpi_item_id: string;
  kpi_name: string;
  unit: string;
  category: string;
  target_value: number;
  actual_value: number | null;
  pct: number;
  status: string;
  status_label: string;
  is_from_weekly_report: boolean;
}

interface Brand { id: string; name: string; }

export default function KpiMonitorPage() {
  const [user, setUser] = useState<{ role: string; brand_id: string | null; brand_name: string | null } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [view, setView] = useState<'today' | 'week'>('week');
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasWeeklyReport, setHasWeeklyReport] = useState(false);
  const week = getCurrentWeek();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUser(d.user);
      if (d.user?.brand_id) setSelectedBrand(d.user.brand_id);
    });
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
  }, []);

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    fetch(`/api/kpi-monitor?brand_id=${selectedBrand}&week_start=${week.week_start}&week_end=${week.week_end}&week_label=${encodeURIComponent(week.week_label)}`)
      .then(r => r.json())
      .then(d => { setKpis(d.kpis || []); setHasWeeklyReport(d.has_weekly_report); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedBrand, week.week_label]);

  const isOwner = user && ['owner', 'admin'].includes(user.role);

  function exportCSV() {
    const rows = [['KPI', 'Target', 'Aktual', 'Pencapaian (%)', 'Status']];
    kpis.forEach(k => {
      rows.push([k.kpi_name, String(k.target_value), String(k.actual_value ?? ''), String(k.pct), k.status_label]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `KPI_${selectedBrand}_${week.week_label.replace(/\s/g, '_')}.csv`;
    a.click();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Monitor KPI</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{week.week_label}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Brand selector (owner) */}
          {isOwner && brands.length > 0 && (
            <select className="input" style={{ width: 'auto' }} value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}>
              <option value="">Semua Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            {(['today', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? 'var(--gold)' : 'transparent', color: view === v ? '#0A0E1A' : 'var(--text-secondary)' }}>
                {v === 'today' ? 'Hari Ini' : 'Minggu Ini'}
              </button>
            ))}
          </div>

          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Memuat data KPI...</div>
      ) : !selectedBrand ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Pilih brand untuk melihat KPI</div>
      ) : (
        <>
          {hasWeeklyReport && (
            <div style={{ padding: '10px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#93C5FD' }}>
              ℹ️ Data KPI diambil dari Weekly Report yang sudah disubmit untuk minggu ini
            </div>
          )}

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'KPI Achieved', count: kpis.filter(k => k.status === 'achieved').length, color: '#10B981' },
              { label: 'On Track', count: kpis.filter(k => k.status === 'on_track').length, color: '#22C55E' },
              { label: 'At Risk', count: kpis.filter(k => k.status === 'at_risk').length, color: '#F59E0B' },
              { label: 'Behind', count: kpis.filter(k => k.status === 'behind').length, color: '#EF4444' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* KPI Table */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Tabel KPI Mingguan</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Target</th>
                    <th>Aktual (Kumulatif)</th>
                    <th>Pencapaian</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Belum ada data KPI. Pastikan target sudah diset dan sprint sudah disubmit.</td></tr>
                  ) : kpis.map(kpi => (
                    <tr key={kpi.kpi_item_id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{kpi.kpi_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{kpi.category.replace('_', ' ')}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatNum(kpi.target_value, kpi.unit)}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{kpi.actual_value !== null ? formatNum(kpi.actual_value, kpi.unit) : '—'}</span>
                        {kpi.is_from_weekly_report && <span style={{ fontSize: 10, color: '#93C5FD', marginLeft: 4 }}>WR</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="progress-bar" style={{ width: 80 }}>
                            <div className="progress-fill" style={{ width: `${Math.min(kpi.pct, 100)}%`, background: kpi.pct >= 100 ? '#10B981' : kpi.pct >= 70 ? '#22C55E' : kpi.pct >= 50 ? '#F59E0B' : '#EF4444' }} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{kpi.pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getKpiStatusClass(kpi.pct)}`}>{kpi.status_label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
