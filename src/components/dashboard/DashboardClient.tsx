'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SessionUser } from '@/lib/session';
import { formatDateShort } from '@/lib/utils';

interface Props {
  user: SessionUser;
  todayLabel: string;
  pagiSubmitted: boolean;
  soreSubmitted: boolean;
  dailyCounts: { date: string; count: number }[];
  statusBoardData: { brand_name: string; brand_id: string; statuses: Record<string, { pagi: boolean; sore: boolean; name: string }> }[];
  recentReports: { id: string; title: string; category: string; status: string; report_date: string; submitted_by_name: string | null; brand_name: string }[];
  weekLabel: string;
  brandId: string | null;
}

const CATEGORY_LABELS: Record<string, string> = { creative: 'Creative', public_relation: 'PR', marketplace: 'Marketplace', rnd: 'R&D', general: 'General' };
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', reviewed: 'Reviewed' };

export default function DashboardClient({ user, todayLabel, pagiSubmitted, soreSubmitted, dailyCounts, statusBoardData, recentReports, weekLabel, brandId }: Props) {
  const isOwner = ['owner', 'admin'].includes(user.role);
  const isManager = ['owner', 'admin', 'brand_manager'].includes(user.role);

  const chartData = dailyCounts.map(d => ({
    name: formatDateShort(d.date).split(' ')[0],
    Sprint: d.count,
  }));

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{todayLabel}</p>
      </div>

      {/* Sprint Status Card */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Status Sprint Hari Ini</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <StatusDot label="Sprint Pagi" done={pagiSubmitted} />
              <StatusDot label="Sprint Sore" done={soreSubmitted} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!pagiSubmitted && (
              <Link href="/standup?tab=pagi" className="btn btn-primary btn-sm">⚡ Isi Sprint Pagi</Link>
            )}
            {!soreSubmitted && (
              <Link href="/standup?tab=sore" className="btn btn-secondary btn-sm">🌆 Isi Sprint Sore</Link>
            )}
            {pagiSubmitted && soreSubmitted && (
              <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>✅ Sprint hari ini selesai!</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Widget for BM/Owner */}
      {isManager && brandId && (
        <KpiWidget brandId={brandId} weekLabel={weekLabel} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Activity Chart */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Aktivitas Sprint (7 Hari)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }}
                cursor={{ fill: 'rgba(201,168,76,0.08)' }}
              />
              <Bar dataKey="Sprint" fill="var(--gold)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Reports */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Laporan Harian Terbaru</h3>
            <Link href="/reports" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Lihat semua →</Link>
          </div>
          {recentReports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada laporan harian</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentReports.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{CATEGORY_LABELS[r.category]} · {formatDateShort(r.report_date)}</div>
                  </div>
                  <span className={`badge ${r.status === 'reviewed' ? 'status-achieved' : r.status === 'submitted' ? 'status-on-track' : 'status-behind'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Standup Status Board (Owner only) */}
      {isOwner && statusBoardData.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Status Board Tim (Hari Ini)</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {statusBoardData.map(brand => {
              const entries = Object.entries(brand.statuses);
              const pagiCount = entries.filter(([, v]) => v.pagi).length;
              const soreCount = entries.filter(([, v]) => v.sore).length;
              const total = entries.length;
              const belumPagi = entries.filter(([, v]) => !v.pagi).map(([, v]) => v.name.split(' ')[0]);
              const belumSore = entries.filter(([, v]) => !v.sore).map(([, v]) => v.name.split(' ')[0]);

              return (
                <div key={brand.brand_id} style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ width: 110, fontSize: 13, fontWeight: 600, color: 'var(--gold)', flexShrink: 0 }}>{brand.brand_name}</div>
                    <div style={{ display: 'flex', gap: 16, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Sprint Pagi: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{pagiCount}/{total}</span>
                        {belumPagi.length > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                            ({belumPagi.join(', ')})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Sprint Sore: <span style={{ color: soreCount === total ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>{soreCount}/{total}</span>
                        {belumSore.length > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                            ({belumSore.join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {entries.map(([uid, v]) => (
                        <div key={uid} title={`${v.name}: ${v.pagi && v.sore ? 'Lengkap' : v.pagi ? 'Pagi saja' : 'Belum isi'}`} style={{ width: 10, height: 10, borderRadius: '50%', background: v.pagi && v.sore ? 'var(--green)' : v.pagi ? 'var(--amber)' : 'var(--border)' }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: done ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
      {done && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>}
    </div>
  );
}

function KpiWidget({ brandId, weekLabel }: { brandId: string; weekLabel: string }) {
  // Client-side fetch for KPI widget
  const [kpis, setKpis] = useState<{ kpi_name: string; pct: number; status: string; actual_value: number | null; target_value: number; unit: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    const week = getCurrentWeek(new Date());
    fetch(`/api/kpi-monitor?brand_id=${brandId}&week_start=${week.week_start}&week_end=${week.week_end}&week_label=${encodeURIComponent(weekLabel)}`)
      .then(r => r.json())
      .then(d => { setKpis(d.kpis || []); setLoading(false); })
      .catch(() => setLoading(false));
  });

  if (loading) return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Progress KPI Minggu Ini — {weekLabel}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Memuat data KPI...</div>
    </div>
  );

  if (kpis.length === 0) return null;

  const topKpis = kpis.slice(0, 4);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Progress KPI — {weekLabel}</h3>
        <Link href="/kpi-monitor" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Detail →</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {topKpis.map(kpi => (
          <KpiCard key={kpi.kpi_name} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { getCurrentWeek } from '@/lib/utils';

function KpiCard({ kpi }: { kpi: { kpi_name: string; pct: number; status: string; actual_value: number | null; target_value: number; unit: string } }) {
  const colors: Record<string, string> = { achieved: '#10B981', on_track: '#22C55E', at_risk: '#F59E0B', behind: '#EF4444' };
  const color = colors[kpi.status] || '#94A3B8';

  return (
    <div style={{ padding: 14, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{kpi.kpi_name}</div>
      <div className="progress-bar" style={{ marginBottom: 6 }}>
        <div className="progress-fill" style={{ width: `${Math.min(kpi.pct, 100)}%`, background: color }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{kpi.pct}%</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{kpi.status.replace('_', ' ')}</span>
      </div>
    </div>
  );
}
