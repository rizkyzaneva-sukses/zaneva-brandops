'use client';

import { useState, useEffect } from 'react';
import { formatDateShort, ROLE_LABELS, ROLE_CLASS } from '@/lib/utils';

interface UserStat { user_id: string; user_name: string; user_role: string; brand_name: string; total: number; pagi: number; sore: number; complete: number; compliance: number; }
interface Brand { id: string; name: string; }

export default function IndividualReportPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userStandups, setUserStandups] = useState<{ standup_date: string; session: string; status: string; answers: Record<string, unknown> }[]>([]);

  useEffect(() => {
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
  }, []);

  async function fetchStats() {
    setLoading(true);
    let url = `/api/standups?date_from=${dateFrom}&date_to=${dateTo}&status=submitted`;
    if (filterBrand) url += `&brand_id=${filterBrand}`;
    const res = await fetch(url);
    const standups = await res.json();

    // Group by user
    const userMap: Record<string, { user_name: string; user_role: string; brand_name: string; pagi: Set<string>; sore: Set<string> }> = {};
    standups.forEach((s: { user_id: string; user_name: string; user_role: string; brand_name: string; session: string; standup_date: string }) => {
      if (!userMap[s.user_id]) {
        userMap[s.user_id] = { user_name: s.user_name, user_role: s.user_role, brand_name: s.brand_name, pagi: new Set(), sore: new Set() };
      }
      const dateStr = s.standup_date.split('T')[0];
      if (s.session === 'pagi') userMap[s.user_id].pagi.add(dateStr);
      else if (s.session === 'sore') userMap[s.user_id].sore.add(dateStr);
    });

    // Calculate working days in range
    let workDays = 0;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) workDays++;
    }

    const result: UserStat[] = Object.entries(userMap).map(([uid, u]) => {
      const complete = [...u.pagi].filter(d => u.sore.has(d)).length;
      const totalSessions = u.pagi.size + u.sore.size;
      const maxSessions = workDays * 2;
      const compliance = maxSessions > 0 ? Math.round((totalSessions / maxSessions) * 100) : 0;
      return {
        user_id: uid,
        user_name: u.user_name,
        user_role: u.user_role,
        brand_name: u.brand_name,
        total: totalSessions,
        pagi: u.pagi.size,
        sore: u.sore.size,
        complete,
        compliance,
      };
    });

    result.sort((a, b) => b.compliance - a.compliance);
    setStats(result);
    setLoading(false);
  }

  async function loadUserDetail(userId: string) {
    setSelectedUser(userId);
    const res = await fetch(`/api/standups?user_id=${userId}&date_from=${dateFrom}&date_to=${dateTo}&status=submitted`);
    const data = await res.json();
    setUserStandups(data.map((s: { standup_date: string; session: string; status: string; answers: Record<string, unknown> }) => ({
      standup_date: s.standup_date,
      session: s.session,
      status: s.status,
      answers: s.answers,
    })));
  }

  const selectedUserData = stats.find(s => s.user_id === selectedUser);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Laporan Kinerja Individu</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analisis compliance sprint & performa per anggota tim</p>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Brand</label>
            <select className="input" style={{ width: 'auto' }} value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
              <option value="">Semua Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Dari Tanggal</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Sampai Tanggal</label>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={fetchStats} disabled={loading}>
            {loading ? 'Memuat...' : '🔍 Analisis'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 360px' : '1fr', gap: 20 }}>
        {/* Main Table */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Compliance Sprint — {dateFrom} s/d {dateTo}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Role</th>
                <th>Brand</th>
                <th>Sprint Pagi</th>
                <th>Sprint Sore</th>
                <th>Lengkap</th>
                <th>Compliance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>{loading ? 'Memuat...' : 'Klik "Analisis" untuk melihat data'}</td></tr>
              ) : stats.map(u => (
                <tr key={u.user_id} style={{ background: selectedUser === u.user_id ? 'rgba(201,168,76,0.06)' : undefined }}>
                  <td style={{ fontWeight: 500 }}>{u.user_name}</td>
                  <td><span className={`badge ${ROLE_CLASS[u.user_role] || 'role-owner'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[u.user_role] || u.user_role}</span></td>
                  <td style={{ color: 'var(--gold)', fontSize: 13 }}>{u.brand_name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 500 }}>{u.pagi}</td>
                  <td style={{ textAlign: 'center', fontWeight: 500 }}>{u.sore}</td>
                  <td style={{ textAlign: 'center', fontWeight: 500 }}>{u.complete}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(u.compliance, 100)}%`, background: u.compliance >= 90 ? '#10B981' : u.compliance >= 70 ? '#22C55E' : u.compliance >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: u.compliance >= 90 ? '#10B981' : u.compliance >= 70 ? '#22C55E' : u.compliance >= 50 ? '#F59E0B' : '#EF4444' }}>{u.compliance}%</span>
                    </div>
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => loadUserDetail(u.user_id)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* User Detail Panel */}
        {selectedUser && selectedUserData && (
          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>{selectedUserData.user_name}</h3>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span className={`badge ${ROLE_CLASS[selectedUserData.user_role] || 'role-owner'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[selectedUserData.user_role]}</span>
              <span style={{ fontSize: 11, color: 'var(--gold)' }}>{selectedUserData.brand_name}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <StatBox label="Pagi" value={selectedUserData.pagi} />
              <StatBox label="Sore" value={selectedUserData.sore} />
              <StatBox label="Lengkap" value={selectedUserData.complete} />
              <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: selectedUserData.compliance >= 90 ? '#10B981' : selectedUserData.compliance >= 70 ? '#22C55E' : '#EF4444' }}>{selectedUserData.compliance}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Compliance</div>
              </div>
            </div>

            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Riwayat Sprint</h4>
            <div style={{ maxHeight: 380, overflowY: 'auto', display: 'grid', gap: 6 }}>
              {userStandups.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{s.session === 'pagi' ? '☀️' : '🌆'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateShort(s.standup_date)}</span>
                  </div>
                  <span className={`badge ${s.status === 'submitted' ? 'status-on-track' : 'status-behind'}`} style={{ fontSize: 9 }}>{s.session}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
