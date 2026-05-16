'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getStandupQuestions, getDailyLogConfig, CONTENT_STATUS_OPTIONS } from '@/lib/standupConfig';
import { getCurrentWeek, formatCurrency, parseNum } from '@/lib/utils';
import Link from 'next/link';

interface User {
  id: string;
  full_name: string;
  role: string;
  brand_id: string | null;
  brand_name: string | null;
}

interface Standup {
  id: string;
  session: string;
  status: string;
  answers: Record<string, unknown>;
  daily_log: Record<string, unknown>;
  standup_date: string;
}

interface KpiFeedback {
  kpi_name: string;
  pct: number;
  status: string;
  actual_value: number | null;
  target_value: number;
  unit: string;
}

function extractContentLog(dailyLog: Record<string, unknown>) {
  const next: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(dailyLog || {})) {
    const match = key.match(/^(.*)_(title|status|notes)$/);
    if (!match) continue;
    const [, baseKey, field] = match;
    next[baseKey] = next[baseKey] || {};
    next[baseKey][field] = String(value || '');
  }
  return next;
}

export default function StandupPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'pagi' | 'sore'>(searchParams.get('tab') === 'sore' ? 'sore' : 'pagi');
  const [todayStandups, setTodayStandups] = useState<Standup[]>([]);
  const [yesterdayStandup, setYesterdayStandup] = useState<Standup | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dailyLog, setDailyLog] = useState<Record<string, string>>({});
  const [contentLog, setContentLog] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [kpiFeedback, setKpiFeedback] = useState<KpiFeedback[] | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [dynamicLogFields, setDynamicLogFields] = useState<any[] | null>(null);
  const [isEditingSubmitted, setIsEditingSubmitted] = useState(false);

  // Use local date (YYYY-MM-DD) to match user's actual day
  const today = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUser = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  }, []);

  const fetchStandups = useCallback(async (userId?: string) => {
    if (!userId) return;
    const res = await fetch(`/api/standups?user_id=${userId}&date=${today}`);
    if (res.ok) {
      const data = await res.json();
      setTodayStandups(data);

      // Load existing data into forms
      const currentTab = tab;
      const existing = data.find((s: Standup) => s.session === currentTab);
      if (existing) {
        setAnswers(existing.answers as Record<string, string>);
        if (currentTab === 'sore') {
          const existingDailyLog = existing.daily_log as Record<string, string>;
          setDailyLog(existingDailyLog);
          setContentLog(extractContentLog(existingDailyLog));
        }
      }
      setIsEditingSubmitted(false);
    }

    // Yesterday standup (sore) - use local date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const res2 = await fetch(`/api/standups?user_id=${userId}&date=${yd}&session=sore`);
    if (res2.ok) {
      const data2 = await res2.json();
      setYesterdayStandup(data2[0] || null);
    }
  }, [today, tab]);

  const fetchDynamicKpis = useCallback(async (brandId: string, role: string) => {
    try {
      const res = await fetch(`/api/kpi-monitor/items?brand_id=${brandId}&enabled_only=true`);
      if (res.ok) {
        const data = await res.json();
        // Filter KPIs assigned to this role:
        // 1. auto_daily_log KPIs with matching auto_source_role
        // 2. manual KPIs with matching auto_source_role (assigned to role for daily input)
        // For brand_manager: also include KPIs where auto_source_role is null/empty
        const assigned = data.filter((c: any) => {
          const category = c.kpi_item.category;
          const sourceRole = c.kpi_item.auto_source_role;
          // auto_sum KPIs are never shown in daily log (they aggregate automatically)
          if (category === 'auto_sum') return false;
          // Match by role assignment
          if (sourceRole === role) return true;
          // Brand manager sees all unassigned KPIs (auto_daily_log or manual without role)
          if (role === 'brand_manager' && !sourceRole && category !== 'auto_sum') return true;
          return false;
        });
        setDynamicLogFields(assigned.map((c: any) => ({
          key: c.kpi_item.auto_source || `custom_${c.kpi_item_id}`,
          label: c.kpi_name,
          unit: c.kpi_item.unit,
          placeholder: c.kpi_item.unit === 'currency' ? '0' : c.kpi_item.unit === 'percent' ? '0' : '0',
        })));
      } else {
        setDynamicLogFields([]);
      }
    } catch {
      setDynamicLogFields([]);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user) {
      fetchStandups(user.id);
      if (user.brand_id) fetchDynamicKpis(user.brand_id, user.role);
    }
  }, [user, tab, fetchStandups, fetchDynamicKpis]);

  const currentStandup = todayStandups.find(s => s.session === tab);
  const isSubmitted = currentStandup?.status === 'submitted';
  const canEdit = !!user; // semua role bisa edit sprint sendiri
  const sections = user ? getStandupQuestions(user.role, tab) : [];

  // Daily Log Config: prioritize dynamic KPI fields from KPI Config (per role)
  // Only fall back to hardcoded config if dynamic fetch hasn't completed yet (null)
  let logConfig: ReturnType<typeof getDailyLogConfig> = null;

  if (dynamicLogFields !== null && dynamicLogFields.length > 0) {
    // Use dynamic fields from KPI Config — this is the primary source
    const roleLabel = user?.role === 'brand_manager' ? 'Brand Manager'
      : user?.role === 'admin_marketplace' ? 'Admin Marketplace'
        : user?.role === 'public_relation' ? 'Public Relation'
          : user?.role === 'creative' ? 'Creative'
            : user?.role === 'rnd' ? 'R&D'
              : user?.role || '';
    logConfig = {
      title: `Daily KPI Log — ${roleLabel}`,
      columns: ['Metrik', 'Aktual', 'Catatan'],
      rows: dynamicLogFields.map(f => ({
        key: f.key,
        label: f.label + (f.unit === 'currency' ? ' (Rp)' : f.unit === 'percent' ? ' (%)' : ''),
        unit: f.unit as 'currency' | 'number' | 'text' | 'status',
        placeholder: f.placeholder || (f.unit === 'currency' ? '0' : '0'),
      })),
    };
  } else if (dynamicLogFields === null) {
    // Still loading — use hardcoded config as temporary fallback
    logConfig = user ? getDailyLogConfig(user.role) : null;
  }
  // If dynamicLogFields is [] (empty array), it means no KPIs are assigned to this role — show nothing

  async function handleSave(status: 'draft' | 'submitted') {
    if (!user) return;
    setSaving(true);

    try {
      const dailyLogData: Record<string, string> = { ...dailyLog };

      // Merge content log
      if (logConfig?.rows.some(r => r.unit === 'status')) {
        for (const [key, val] of Object.entries(contentLog)) {
          for (const [field, v] of Object.entries(val)) {
            dailyLogData[`${key}_${field}`] = v;
          }
        }
      }

      const payload = {
        session: tab,
        standup_date: today,
        answers,
        daily_log: tab === 'sore' ? dailyLogData : {},
        status,
      };

      const res = await fetch('/api/standups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(status === 'submitted' ? `Sprint ${tab} berhasil disubmit! ✅` : 'Draft tersimpan');
        fetchStandups(user.id);
        setIsEditingSubmitted(false);

        // Load KPI feedback after sore submit
        if (status === 'submitted' && tab === 'sore' && user.brand_id) {
          const week = getCurrentWeek();
          const feedRes = await fetch(`/api/kpi-monitor?brand_id=${user.brand_id}&week_start=${week.week_start}&week_end=${week.week_end}&week_label=${encodeURIComponent(week.week_label)}`);
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            const relevant = (feedData.kpis || []).filter((k: { status: string }) => k.status);
            setKpiFeedback(relevant);
            setShowFeedback(true);
          }
        }
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || errData?.detail || 'Gagal menyimpan';
        showToast(errMsg, 'error');
        console.error('[Standup] Save failed:', res.status, errData);
      }
    } catch (err) {
      console.error('[Standup] Network error:', err);
      showToast('Gagal menyimpan: koneksi bermasalah', 'error');
    }

    setSaving(false);
  }

  function handleEdit() {
    setShowFeedback(false);
    setIsEditingSubmitted(true);
  }

  function handleCancelEdit() {
    setIsEditingSubmitted(false);
    if (currentStandup) {
      setAnswers(currentStandup.answers as Record<string, string>);
      if (tab === 'sore') {
        const existingDailyLog = currentStandup.daily_log as Record<string, string>;
        setDailyLog(existingDailyLog);
        setContentLog(extractContentLog(existingDailyLog));
      }
    }
  }

  if (!user) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Memuat...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Daily Sprint</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tab Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {(['pagi', 'sore'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowFeedback(false); setIsEditingSubmitted(false); setAnswers({}); setDailyLog({}); setContentLog({}); }}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: tab === t ? 'var(--gold)' : 'transparent',
              color: tab === t ? '#0A0E1A' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'pagi' ? '☀️ PAGI' : '🌆 SORE'}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      {isSubmitted && !showFeedback && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 14, color: 'var(--green)', fontWeight: 500 }}>
            {isEditingSubmitted ? `✏️ Mode revisi Sprint ${tab} aktif` : `✅ Sprint ${tab} sudah disubmit`}
          </span>
          {canEdit && (
            isEditingSubmitted
              ? <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>Batal</button>
              : <button className="btn btn-ghost btn-sm" onClick={handleEdit}>Edit</button>
          )}
        </div>
      )}

      {/* Post-Submit KPI Feedback */}
      {showFeedback && kpiFeedback && (
        <PostSubmitFeedback kpis={kpiFeedback} onClose={() => setShowFeedback(false)} />
      )}

      {/* Form area */}
      {(!isSubmitted || showFeedback === false) && !showFeedback && (
        <>
          {/* Recap kemarin (pagi only) */}
          {tab === 'pagi' && yesterdayStandup && (
            <div className="card" style={{ marginBottom: 20 }}>
              <button
                onClick={() => setRecapOpen(!recapOpen)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0 }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>📋 Recap Sprint Sore Kemarin</span>
                <span style={{ color: 'var(--text-muted)' }}>{recapOpen ? '▲' : '▼'}</span>
              </button>
              {recapOpen && (
                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  {Object.entries(yesterdayStandup.answers).filter(([, v]) => v).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{key.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 6 }}>{String(val)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sprint Form */}
          {sections.map(section => (
            <div key={section.id} className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{section.section}</h3>
              <div style={{ display: 'grid', gap: 14 }}>
                {section.fields.map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {field.label} {field.required && <span style={{ color: 'var(--red)' }}>*</span>}
                    </label>
                    {field.hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{field.hint}</p>}
                    {field.type === 'textarea' ? (
                      <textarea
                        className="input"
                        disabled={isSubmitted && !isEditingSubmitted}
                        value={(answers[field.key] as string) || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <input
                        className="input"
                        type="text"
                        disabled={isSubmitted && !isEditingSubmitted}
                        value={(answers[field.key] as string) || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Daily Log (sore only) */}
          {tab === 'sore' && logConfig && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{logConfig.title}</h3>

              {logConfig.rows[0]?.unit === 'status' ? (
                // Creative/RnD - content log
                <div style={{ display: 'grid', gap: 12 }}>
                  {logConfig.rows.map(row => (
                    <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 1fr', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                      <input className="input" placeholder="Judul / nama konten" disabled={isSubmitted && !isEditingSubmitted}
                        value={contentLog[row.key]?.title || ''}
                        onChange={e => setContentLog(p => ({ ...p, [row.key]: { ...p[row.key], title: e.target.value } }))}
                      />
                      <select className="input" disabled={isSubmitted && !isEditingSubmitted}
                        value={contentLog[row.key]?.status || ''}
                        onChange={e => setContentLog(p => ({ ...p, [row.key]: { ...p[row.key], status: e.target.value } }))}
                      >
                        <option value="">Status</option>
                        {CONTENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input className="input" placeholder="Catatan" disabled={isSubmitted && !isEditingSubmitted}
                        value={contentLog[row.key]?.notes || ''}
                        onChange={e => setContentLog(p => ({ ...p, [row.key]: { ...p[row.key], notes: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                // BM/Marketplace/PR - metrics table
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {logConfig.columns.map(col => (
                        <th key={col} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logConfig.rows.map(row => (
                      <tr key={row.key}>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>{row.label}</td>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                          <input
                            className="input"
                            type={row.unit === 'text' ? 'text' : 'number'}
                            placeholder={row.placeholder || (row.unit === 'currency' ? 'Rp' : '0')}
                            disabled={isSubmitted && !isEditingSubmitted}
                            value={dailyLog[row.key] || ''}
                            onChange={e => setDailyLog(p => ({ ...p, [row.key]: e.target.value }))}
                            style={{ minWidth: 120 }}
                          />
                        </td>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                          <input
                            className="input"
                            type="text"
                            placeholder="Catatan (opsional)"
                            disabled={isSubmitted && !isEditingSubmitted}
                            value={dailyLog[`${row.key}_catatan`] || ''}
                            onChange={e => setDailyLog(p => ({ ...p, [`${row.key}_catatan`]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {(!isSubmitted || isEditingSubmitted) && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {!isEditingSubmitted && (
                <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
                  💾 Simpan Draft
                </button>
              )}
              <button className="btn btn-primary" onClick={() => handleSave('submitted')} disabled={saving}>
                {saving ? 'Menyimpan...' : isEditingSubmitted ? '✅ Simpan Revisi' : `✅ Submit Sprint ${tab === 'pagi' ? 'Pagi' : 'Sore'}`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function PostSubmitFeedback({ kpis, onClose }: { kpis: KpiFeedback[]; onClose: () => void }) {
  const colors: Record<string, string> = { achieved: '#10B981', on_track: '#22C55E', at_risk: '#F59E0B', behind: '#EF4444' };

  return (
    <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>✅ Sprint Sore Berhasil Disubmit!</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>Progress KPI Minggu Ini</h4>

      <div style={{ display: 'grid', gap: 12 }}>
        {kpis.map(kpi => {
          const color = colors[kpi.status] || '#94A3B8';
          return (
            <div key={kpi.kpi_name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{kpi.kpi_name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{kpi.pct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(kpi.pct, 100)}%`, background: color }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Aktual: {kpi.actual_value !== null ? (kpi.unit === 'currency' ? formatCurrency(kpi.actual_value) : kpi.actual_value.toLocaleString('id-ID')) : '—'}</span>
                <span>Target: {kpi.unit === 'currency' ? formatCurrency(kpi.target_value) : kpi.target_value.toLocaleString('id-ID')}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link href="/kpi-monitor" className="btn btn-secondary btn-sm">📈 Lihat Detail di KPI Monitor</Link>
      </div>
    </div>
  );
}
