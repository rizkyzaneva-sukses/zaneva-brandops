'use client';

import { useState, useEffect } from 'react';
import { getCurrentWeek, getWeekOptions, formatNum, getKpiStatusClass } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

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

interface TrendPoint { week_label: string;[kpiName: string]: string | number; }

export default function KpiMonitorPage() {
  const [user, setUser] = useState<{ role: string; brand_id: string | null; brand_name: string | null } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [view, setView] = useState<'today' | 'week'>('week');
  const [pageTab, setPageTab] = useState<'monitor' | 'trend'>('monitor');
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasWeeklyReport, setHasWeeklyReport] = useState(false);
  const weekOptions = getWeekOptions(6);
  const [selectedWeekLabel, setSelectedWeekLabel] = useState<string>(weekOptions[0]?.week_label || '');
  const week = weekOptions.find(w => w.week_label === selectedWeekLabel) || getCurrentWeek();

  // Trend state
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendKpiNames, setTrendKpiNames] = useState<string[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

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
  }, [selectedBrand, selectedWeekLabel]);

  // Load trend data when switching to trend tab
  useEffect(() => {
    if (pageTab !== 'trend' || !selectedBrand) return;
    setTrendLoading(true);

    // Fetch KPI data for last 8 weeks
    const weeksToFetch = weekOptions.slice(0, 8).reverse(); // oldest first
    Promise.all(
      weeksToFetch.map(w =>
        fetch(`/api/kpi-monitor?brand_id=${selectedBrand}&week_start=${w.week_start}&week_end=${w.week_end}&week_label=${encodeURIComponent(w.week_label)}`)
          .then(r => r.json())
          .then(d => ({ week_label: w.week_label, kpis: d.kpis || [] }))
          .catch(() => ({ week_label: w.week_label, kpis: [] }))
      )
    ).then(results => {
      // Build trend data
      const allKpiNames = new Set<string>();
      const points: TrendPoint[] = results.map(r => {
        const point: TrendPoint = { week_label: r.week_label.replace(/\[.*?\]/, '').trim() };
        r.kpis.forEach((k: KpiData) => {
          allKpiNames.add(k.kpi_name);
          point[k.kpi_name] = k.pct;
        });
        return point;
      });
      setTrendData(points);
      setTrendKpiNames(Array.from(allKpiNames));
      setTrendLoading(false);
    });
  }, [pageTab, selectedBrand]);

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

  const TREND_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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

          {pageTab === 'monitor' && (
            <>
              {/* Week selector */}
              <select className="input" style={{ width: 'auto' }} value={selectedWeekLabel} onChange={e => setSelectedWeekLabel(e.target.value)}>
                {weekOptions.map(w => <option key={w.week_label} value={w.week_label}>{w.week_label}</option>)}
              </select>

              {/* View toggle */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                {(['today', 'week'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? 'var(--gold)' : 'transparent', color: view === v ? '#0A0E1A' : 'var(--text-secondary)' }}>
                    {v === 'today' ? 'Hari Ini' : 'Minggu Ini'}
                  </button>
                ))}
              </div>

              <button className="btn btn-secondary btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
            </>
          )}
        </div>
      </div>

      {/* Page Tab Toggle */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['monitor', 'trend'] as const).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: pageTab === t ? 'var(--gold)' : 'transparent', color: pageTab === t ? '#0A0E1A' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
            {t === 'monitor' ? '📊 Monitor' : '📈 Trend'}
          </button>
        ))}
      </div>

      {/* MONITOR TAB */}
      {pageTab === 'monitor' && (
        <>
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
        </>
      )}

      {/* TREND TAB */}
      {pageTab === 'trend' && (
        <div>
          {!selectedBrand ? (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Pilih brand untuk melihat trend KPI</div>
          ) : trendLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Memuat data trend...</div>
          ) : trendData.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Belum ada data trend</div>
          ) : (
            <>
              {/* Trend Chart - Percentage */}
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Trend Pencapaian KPI (%)</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Persentase pencapaian per KPI selama 8 minggu terakhir</p>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} domain={[0, 'auto']} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                        formatter={(value: number) => [`${value}%`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {trendKpiNames.map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={TREND_COLORS[i % TREND_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trend Summary Table */}
              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Ringkasan Trend</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>KPI</th>
                        {trendData.map(p => <th key={p.week_label} style={{ fontSize: 11 }}>{p.week_label}</th>)}
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendKpiNames.map(name => {
                        const values = trendData.map(p => (typeof p[name] === 'number' ? p[name] as number : null));
                        const validValues = values.filter((v): v is number => v !== null);
                        const lastTwo = validValues.slice(-2);
                        const trend = lastTwo.length === 2 ? (lastTwo[1] > lastTwo[0] ? '📈' : lastTwo[1] < lastTwo[0] ? '📉' : '➡️') : '—';
                        return (
                          <tr key={name}>
                            <td style={{ fontWeight: 500, fontSize: 13 }}>{name}</td>
                            {values.map((v, i) => (
                              <td key={i} style={{ fontSize: 12, color: v !== null ? (v >= 100 ? '#10B981' : v >= 70 ? '#F59E0B' : '#EF4444') : 'var(--text-muted)' }}>
                                {v !== null ? `${v}%` : '—'}
                              </td>
                            ))}
                            <td style={{ fontSize: 16 }}>{trend}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
