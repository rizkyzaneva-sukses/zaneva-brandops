'use client';

import { useState, useEffect } from 'react';
import { formatDateShort } from '@/lib/utils';

interface Report { id: string; title: string; content: string; category: string; status: string; report_date: string; submitted_by_name: string | null; submitted_by_role: string | null; brand_name: string; brand_id: string; }
interface User { id: string; role: string; brand_id: string | null; brand_name: string | null; full_name: string; }
interface Brand { id: string; name: string; }

const CATEGORIES = [
  { value: 'creative', label: 'Creative' },
  { value: 'public_relation', label: 'Public Relation' },
  { value: 'marketplace', label: 'Admin Marketplace' },
  { value: 'rnd', label: 'R&D' },
  { value: 'general', label: 'General' },
];

const CATEGORY_LABELS: Record<string, string> = { creative: 'Creative', public_relation: 'PR', marketplace: 'Marketplace', rnd: 'R&D', general: 'General' };
const STATUS_COLORS: Record<string, string> = { draft: 'status-behind', submitted: 'status-on-track', reviewed: 'status-achieved' };

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [modal, setModal] = useState<'create' | 'view' | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ title: '', content: '', category: 'general', report_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const isManager = user && ['owner', 'admin', 'brand_manager'].includes(user.role);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
    fetch('/api/brands?status=active').then(r => r.json()).then(setBrands);
  }, []);

  const fetchReports = () => {
    let url = '/api/daily-reports?limit=100';
    if (filterBrand) url += `&brand_id=${filterBrand}`;
    if (filterCat) url += `&category=${filterCat}`;
    if (filterStatus) url += `&status=${filterStatus}`;
    fetch(url).then(r => r.json()).then(setReports);
  };

  useEffect(() => { if (user) fetchReports(); }, [user, filterBrand, filterCat, filterStatus]);

  async function handleCreate(status: 'draft' | 'submitted') {
    setSaving(true);
    const res = await fetch('/api/daily-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, status }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(status === 'submitted' ? '✅ Laporan disubmit!' : '💾 Draft tersimpan');
      setModal(null);
      setForm({ title: '', content: '', category: 'general', report_date: new Date().toISOString().split('T')[0] });
      fetchReports();
    }
  }

  async function handleReview(id: string) {
    await fetch(`/api/daily-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    });
    showToast('✅ Laporan ditandai reviewed');
    fetchReports();
    setModal(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus laporan ini?')) return;
    await fetch(`/api/daily-reports/${id}`, { method: 'DELETE' });
    showToast('Laporan dihapus');
    fetchReports();
    setModal(null);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Laporan Harian</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Dokumentasi aktivitas harian per divisi</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ title: '', content: '', category: 'general', report_date: new Date().toISOString().split('T')[0] }); setModal('create'); }}>
          + Buat Laporan
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {isManager && brands.length > 0 && (
          <select className="input" style={{ width: 'auto' }} value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
            <option value="">Semua Brand</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="input" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Judul</th>
              <th>Brand</th>
              <th>Kategori</th>
              <th>Tanggal</th>
              <th>Oleh</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Belum ada laporan harian</td></tr>
            ) : reports.map(r => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedReport(r); setModal('view'); }}>
                <td style={{ maxWidth: 280 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                </td>
                <td style={{ color: 'var(--gold)', fontWeight: 500 }}>{r.brand_name}</td>
                <td><span className="badge role-brand_manager" style={{ fontSize: 9 }}>{CATEGORY_LABELS[r.category]}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDateShort(r.report_date)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.submitted_by_name || '—'}</td>
                <td><span className={`badge ${STATUS_COLORS[r.status]}`} style={{ fontSize: 9 }}>{r.status}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isManager && r.status === 'submitted' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleReview(r.id)}>✓ Review</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {modal === 'create' && (
        <Modal title="Buat Laporan Harian" onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Tanggal</label>
                <input className="input" type="date" value={form.report_date} onChange={e => setForm(p => ({ ...p, report_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Kategori</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Judul Laporan</label>
              <input className="input" type="text" placeholder="e.g. Rekap Aktivitas Creative — 1 Mei 2026" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Isi Laporan</label>
              <textarea className="input" rows={8} placeholder="Tuliskan isi laporan harian di sini..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => handleCreate('draft')} disabled={saving}>💾 Draft</button>
              <button className="btn btn-primary" onClick={() => handleCreate('submitted')} disabled={saving}>✅ Submit</button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {modal === 'view' && selectedReport && (
        <Modal title={selectedReport.title} onClose={() => setModal(null)}>
          <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <span className={`badge ${STATUS_COLORS[selectedReport.status]}`}>{selectedReport.status}</span>
              <span className="badge role-brand_manager">{CATEGORY_LABELS[selectedReport.category]}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateShort(selectedReport.report_date)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedReport.brand_name}</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 20 }}>{selectedReport.content}</div>
            {selectedReport.submitted_by_name && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>Dibuat oleh: {selectedReport.submitted_by_name} ({selectedReport.submitted_by_role})</p>
            )}
            {isManager && selectedReport.status === 'submitted' && (
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => handleReview(selectedReport.id)}>✓ Mark as Reviewed</button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}
