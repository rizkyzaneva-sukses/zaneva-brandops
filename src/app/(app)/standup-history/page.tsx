'use client';

import { useState, useEffect } from 'react';
import { formatDateShort, ROLE_LABELS, ROLE_CLASS } from '@/lib/utils';

interface StandupRecord { id: string; session: string; status: string; standup_date: string; user_name: string; user_role: string; brand_name: string; answers: Record<string, unknown>; daily_log: Record<string, unknown>; }
interface Brand { id: string; name: string; }
interface AttendanceUser { user_id: string; full_name: string; role: string; brand_name: string; days: Record<string, { pagi: boolean; sore: boolean }>; totalPagi: number; totalSore: number; totalDays: number; pctPagi: number; pctSore: number; pctTotal: number; }

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
  const [pageTab, setPageTab] = useState<'history' | 'kehadiran'>('history');

  // Attendance state
  const [attendanceData, setAttendanceData] = useState<AttendanceUser[]>([]);
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attBrand, setAttBrand] = useState('');
  const [attDateFrom, setAttDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  });
  const [attDateTo, setAttDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Edit modal state
  const [editingStandup, setEditingStandup] = useState<StandupRecord | null>(null);
  const [editAnswers, setEditAnswers] = useState<Record<string, string>>({});
  const [editDailyLog, setEditDailyLog] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const isManager = user && ['owner', 'admin', 'brand_manager'].includes(user.role);
  const canEditOthers = user && ['owner', 'brand_manager'].includes(user.role);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
  }, []);

  const fetchStandups = () => {
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
  };

  useEffect(() => {
    fetchStandups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterBrand, filterSession, filterStatus, filterDateFrom, filterDateTo, myOnly]);

  function toggleExpand(id: string) { setExpanded(prev => prev === id ? null : id); }

  function openEditModal(e: React.MouseEvent, standup: StandupRecord) {
    e.stopPropagation();
    setEditingStandup(standup);
    // Convert answers and daily_log to string records for editing
    const ans: Record<string, string> = {};
    for (const [k, v] of Object.entries(standup.answers)) {
      ans[k] = String(v || '');
    }
    setEditAnswers(ans);

    const dl: Record<string, string> = {};
    for (const [k, v] of Object.entries(standup.daily_log)) {
      dl[k] = String(v || '');
    }
    setEditDailyLog(dl);
  }

  function closeEditModal() {
    setEditingStandup(null);
    setEditAnswers({});
    setEditDailyLog({});
  }

  async function handleEditSave() {
    if (!editingStandup) return;
    setEditSaving(true);

    try {
      const res = await fetch('/api/standups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standup_id: editingStandup.id,
          answers: editAnswers,
          daily_log: editDailyLog,
        }),
      });

      if (res.ok) {
        showToast('Sprint berhasil diupdate ✅');
        closeEditModal();
        fetchStandups();
      } else {
        const err = await res.json();
        showToast(err.error || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Gagal menyimpan', 'error');
    }

    setEditSaving(false);
  }

  // Attendance functions
  function fetchAttendance() {
    if (!attDateFrom || !attDateTo) return;
    setAttendanceLoading(true);
    const params = new URLSearchParams({ date_from: attDateFrom, date_to: attDateTo });
    if (attBrand) params.set('brand_id', attBrand);
    fetch(`/api/attendance?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setAttendanceData(d.attendance || []); setAttendanceDates(d.dates || []); setAttendanceLoading(false); })
      .catch(() => setAttendanceLoading(false));
  }

  useEffect(() => {
    if (pageTab === 'kehadiran') fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTab, attBrand, attDateFrom, attDateTo]);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.type === 'success' ? 'var(--green)' : '#ef4444',
          backdropFilter: 'blur(10px)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>History Sprint</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Riwayat seluruh Daily Sprint</p>
      </div>

      {/* Page Tab Toggle */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['history', 'kehadiran'] as const).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: pageTab === t ? 'var(--gold)' : 'transparent', color: pageTab === t ? '#0A0E1A' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
            {t === 'history' ? '🕐 History' : '📅 Kehadiran'}
          </button>
        ))}
      </div>

      {/* HISTORY TAB */}
      {pageTab === 'history' && (<>
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
                    {canEditOthers && (
                      <button
                        onClick={(e) => openEditModal(e, s)}
                        title="Edit Sprint"
                        style={{
                          background: 'rgba(234,179,8,0.1)',
                          border: '1px solid rgba(234,179,8,0.3)',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--gold)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(234,179,8,0.2)'; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(234,179,8,0.1)'; }}
                      >
                        ✏️ Edit
                      </button>
                    )}
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

        {/* Edit Modal */}
        {editingStandup && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
            onClick={closeEditModal}
          >
            <div
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, width: '100%', maxWidth: 640,
                maxHeight: '85vh', overflow: 'auto',
                padding: 24,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Edit Sprint</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{editingStandup.user_name}</span>
                    <span className={`badge ${ROLE_CLASS[editingStandup.user_role] || 'role-owner'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[editingStandup.user_role]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Sprint {editingStandup.session === 'pagi' ? 'Pagi' : 'Sore'} · {formatDateShort(editingStandup.standup_date)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, color: 'var(--text-muted)', padding: '4px 8px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Edit Answers */}
              {Object.keys(editAnswers).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Jawaban Sprint</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {Object.entries(editAnswers).map(([key, val]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {key.replace(/_/g, ' ')}
                        </label>
                        <textarea
                          className="input"
                          value={val}
                          onChange={e => setEditAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                          rows={2}
                          style={{ width: '100%', resize: 'vertical', minHeight: 40 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit Daily Log */}
              {Object.keys(editDailyLog).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Daily Log</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {Object.entries(editDailyLog).map(([key, val]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {key.replace(/_/g, ' ')}
                        </label>
                        <input
                          className="input"
                          type="text"
                          value={val}
                          onChange={e => setEditDailyLog(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-ghost"
                  onClick={closeEditModal}
                  style={{ padding: '8px 20px', fontSize: 13 }}
                >
                  Batal
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleEditSave}
                  disabled={editSaving}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600 }}
                >
                  {editSaving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>)}

      {/* KEHADIRAN TAB */}
      {pageTab === 'kehadiran' && (
        <div>
          {/* Attendance Filters */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {isManager && (
                <select className="input" style={{ width: 'auto' }} value={attBrand} onChange={e => setAttBrand(e.target.value)}>
                  <option value="">Semua Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              <input className="input" type="date" style={{ width: 'auto' }} value={attDateFrom} onChange={e => setAttDateFrom(e.target.value)} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>s/d</span>
              <input className="input" type="date" style={{ width: 'auto' }} value={attDateTo} onChange={e => setAttDateTo(e.target.value)} />
            </div>
          </div>

          {attendanceLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Memuat data kehadiran...</div>
          ) : attendanceData.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Belum ada data kehadiran</div>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                {(() => {
                  const avgPct = Math.round(attendanceData.reduce((s, a) => s + a.pctTotal, 0) / attendanceData.length);
                  const perfect = attendanceData.filter(a => a.pctTotal === 100).length;
                  const low = attendanceData.filter(a => a.pctTotal < 70).length;
                  return [
                    { label: 'Rata-rata Kehadiran', value: `${avgPct}%`, color: avgPct >= 80 ? '#10B981' : '#F59E0B' },
                    { label: 'Kehadiran Sempurna', value: String(perfect), color: '#10B981' },
                    { label: 'Perlu Perhatian (<70%)', value: String(low), color: low > 0 ? '#EF4444' : '#10B981' },
                    { label: 'Total Anggota', value: String(attendanceData.length), color: 'var(--gold)' },
                  ];
                })().map(s => (
                  <div key={s.label} style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Attendance Grid */}
              <div className="card" style={{ overflowX: 'auto' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Grid Kehadiran</h3>
                <table className="table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 2 }}>Nama</th>
                      <th>Brand</th>
                      {attendanceDates.map(d => {
                        const dt = new Date(d);
                        const dayName = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dt.getDay()];
                        return <th key={d} style={{ textAlign: 'center', minWidth: 40 }}><div>{dayName}</div><div>{dt.getDate()}</div></th>;
                      })}
                      <th style={{ textAlign: 'center' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map(att => (
                      <tr key={att.user_id}>
                        <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1, fontWeight: 500, whiteSpace: 'nowrap' }}>{att.full_name}</td>
                        <td style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{att.brand_name}</td>
                        {attendanceDates.map(d => {
                          const day = att.days[d];
                          if (!day) return <td key={d} style={{ textAlign: 'center' }}>—</td>;
                          return (
                            <td key={d} style={{ textAlign: 'center', padding: '4px 2px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <span style={{ fontSize: 10 }}>{day.pagi ? '🌅' : '⬜'}</span>
                                <span style={{ fontSize: 10 }}>{day.sore ? '🌆' : '⬜'}</span>
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 600, color: att.pctTotal >= 80 ? '#10B981' : att.pctTotal >= 50 ? '#F59E0B' : '#EF4444' }}>
                          {att.pctTotal}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                  🌅 = Sprint Pagi &nbsp; 🌆 = Sprint Sore &nbsp; ⬜ = Belum submit
                </div>
              </div>

              {/* Ranking Table */}
              <div className="card" style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Ranking Kehadiran</h3>
                <table className="table">
                  <thead><tr><th>#</th><th>Nama</th><th>Brand</th><th>Pagi</th><th>Sore</th><th>Total %</th></tr></thead>
                  <tbody>
                    {[...attendanceData].sort((a, b) => b.pctTotal - a.pctTotal).map((att, i) => (
                      <tr key={att.user_id}>
                        <td style={{ fontWeight: 600, color: i < 3 ? 'var(--gold)' : 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{att.full_name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{att.brand_name}</td>
                        <td>{att.totalPagi}/{att.totalDays} ({att.pctPagi}%)</td>
                        <td>{att.totalSore}/{att.totalDays} ({att.pctSore}%)</td>
                        <td style={{ fontWeight: 600, color: att.pctTotal >= 80 ? '#10B981' : att.pctTotal >= 50 ? '#F59E0B' : '#EF4444' }}>{att.pctTotal}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
