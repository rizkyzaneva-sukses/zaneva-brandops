'use client';

import { useState, useEffect } from 'react';
import { formatDateShort, ROLE_LABELS, ROLE_CLASS } from '@/lib/utils';

interface StandupRecord { id: string; session: string; status: string; standup_date: string; user_name: string; user_role: string; brand_name: string; answers: Record<string, unknown>; daily_log: Record<string, unknown>; }
interface Brand { id: string; name: string; }

export default function StandupHistoryPage() {
  const [user, setUser] = useState<{ role: string; brand_id: string | null; id: string } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [standups, setStandups] = useState<StandupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('submitted');
  const [myOnly, setMyOnly] = useState(false);

  const isManager = user && ['owner', 'admin', 'brand_manager'].includes(user.role);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let url = '/api/standups?';
    const params = new URLSearchParams();
    if (filterBrand) params.set('brand_id', filterBrand);
    if (filterSession) params.set('session', filterSession);
    if (filterStatus) params.set('status', filterStatus);
    if (filterDateFrom) params.set('date_from', filterDateFrom);
    if (filterDateTo) params.set('date_to', filterDateTo);
    if (myOnly && user.id) params.set('user_id', user.id);
    url += params.toString();
    fetch(url).then(r => r.json()).then(d => { setStandups(d); setLoading(false); }).catch(() => setLoading(false));
  }, [user, filterBrand, filterSession, filterStatus, filterDateFrom, filterDateTo, myOnly]);

  function toggleExpand(id: string) { setExpanded(prev => prev === id ? null : id); }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>History Sprint</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Riwayat seluruh Daily Sprint</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {isManager && (
            <select className="input" style={{ width: 'auto' }} value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
              <option value="">Semua Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="input" style={{ width: 'auto' }} value={filterSession} onChange={e => setFilterSession(e.target.value)}>
            <option value="">Semua Sesi</option>
            <option value="pagi">Sprint Pagi</option>
            <option value="sore">Sprint Sore</option>
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="submitted">Submitted</option>
            <option value="draft">Draft</option>
          </select>
          <input className="input" type="date" style={{ width: 'auto' }} placeholder="Dari tanggal" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          <input className="input" type="date" style={{ width: 'auto' }} placeholder="Sampai tanggal" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={myOnly} onChange={e => setMyOnly(e.target.checked)} />
            Sprint saya saja
          </label>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Sprint', count: standups.length, color: 'var(--gold)' },
          { label: 'Sprint Pagi', count: standups.filter(s => s.session === 'pagi').length, color: 'var(--green)' },
          { label: 'Sprint Sore', count: standups.filter(s => s.session === 'sore').length, color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Standup Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Memuat data...</div>
      ) : standups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Tidak ada sprint ditemukan</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {standups.map(s => (
            <div key={s.id} className="card" style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => toggleExpand(s.id)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{s.session === 'pagi' ? '☀️' : '🌆'}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.user_name}</span>
                      <span className={`badge ${ROLE_CLASS[s.user_role] || 'role-owner'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[s.user_role]}</span>
                      {isManager && <span style={{ fontSize: 11, color: 'var(--gold)' }}>{s.brand_name}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Sprint {s.session === 'pagi' ? 'Pagi' : 'Sore'} · {formatDateShort(s.standup_date)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge ${s.status === 'submitted' ? 'status-on-track' : 'status-behind'}`} style={{ fontSize: 9 }}>{s.status}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{expanded === s.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded content */}
              {expanded === s.id && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {/* Answers */}
                  {Object.keys(s.answers).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Jawaban Sprint</h4>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {Object.entries(s.answers).filter(([, v]) => v).map(([key, val]) => (
                          <div key={key} style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{key.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{String(val)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Daily Log */}
                  {Object.keys(s.daily_log).length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Daily Log</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {Object.entries(s.daily_log).filter(([k, v]) => v && !k.includes('_catatan')).map(([key, val]) => (
                          <div key={key} style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{String(val)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
