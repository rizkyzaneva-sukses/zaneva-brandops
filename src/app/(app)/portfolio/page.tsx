'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatNum, getProgressColor } from '@/lib/utils';

interface BrandCard {
  brand_id: string;
  brand_name: string;
  week_label: string;
  gmv_actual: number | null;
  gmv_target: number;
  gmv_pct: number;
  avg_score: number;
  behind_count: number;
  achieved_count: number;
  total_kpis: number;
  open_actions: number;
  has_weekly_report: boolean;
  weekly_status: string | null;
  data_source: string;
}

export default function PortfolioPage() {
  const [weekLabel, setWeekLabel] = useState('');
  const [brands, setBrands] = useState<BrandCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/portfolio')
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || 'Gagal memuat portfolio');
        }
        return r.json();
      })
      .then((d) => {
        setWeekLabel(d.week_label || '');
        setBrands(d.brands || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Error');
        setLoading(false);
      });
  }, []);

  const totalBehind = brands.reduce((s, b) => s + b.behind_count, 0);
  const totalOpen = brands.reduce((s, b) => s + b.open_actions, 0);
  const avgPortfolio = brands.length ? Math.round(brands.reduce((s, b) => s + b.avg_score, 0) / brands.length) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Portfolio Brands</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Prioritas Owner · {weekLabel || 'Minggu berjalan'}</p>
        </div>
        <Link href="/kpi-monitor" className="btn btn-secondary btn-sm">Monitor KPI →</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Memuat portfolio...</div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: '#FCA5A5' }}>{error}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Brand aktif', value: brands.length, color: 'var(--gold)' },
              { label: 'Avg score', value: `${avgPortfolio}%`, color: getProgressColor(avgPortfolio) },
              { label: 'KPI behind/risk', value: totalBehind, color: '#EF4444' },
              { label: 'Action open', value: totalOpen, color: '#F59E0B' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Diurutkan worst-first (behind terbanyak, score terendah). Fokus intervensi di atas.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>GMV vs Target</th>
                    <th>Avg Score</th>
                    <th>Behind</th>
                    <th>Action open</th>
                    <th>Weekly</th>
                    <th>Sumber</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {brands.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Belum ada brand aktif</td></tr>
                  ) : brands.map((b) => (
                    <tr key={b.brand_id}>
                      <td style={{ fontWeight: 600 }}>{b.brand_name}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.gmv_actual !== null ? formatNum(b.gmv_actual, 'currency') : '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target {formatNum(b.gmv_target, 'currency')} · {b.gmv_pct}%</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: getProgressColor(b.avg_score) }}>{b.avg_score}%</span>
                      </td>
                      <td>
                        <span className={`badge ${b.behind_count > 0 ? 'status-behind' : 'status-achieved'}`}>{b.behind_count}</span>
                      </td>
                      <td>
                        <span className={`badge ${b.open_actions > 0 ? 'status-at-risk' : 'status-on-track'}`}>{b.open_actions}</span>
                      </td>
                      <td>
                        {b.weekly_status ? (
                          <span className={`badge ${b.weekly_status === 'reviewed' ? 'status-achieved' : 'status-on-track'}`}>{b.weekly_status}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>belum</span>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: b.data_source === 'frozen_weekly' ? '#93C5FD' : '#6EE7B7' }}>
                        {b.data_source === 'frozen_weekly' ? '🔒 Frozen' : '📡 Live'}
                      </td>
                      <td>
                        <Link href={`/kpi-monitor`} style={{ fontSize: 12, color: 'var(--gold)' }}>Detail</Link>
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
