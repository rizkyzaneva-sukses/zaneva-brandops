'use client';

import { useState, useEffect } from 'react';
import { ROLE_LABELS, ROLE_CLASS } from '@/lib/utils';

interface Brand { id: string; name: string; description: string; status: string; }
interface User { id: string; email: string; full_name: string; role: string; brand_id: string | null; brand_name: string | null; is_active: boolean; }
interface KpiConfig { kpi_item_id: string; kpi_name: string; is_enabled: boolean; kpi_item: { unit: string; category: string; description: string | null }; }

const TABS = ['Brand', 'Tim', 'KPI Config'];
const ROLES = [
  { value: 'brand_manager', label: 'Brand Manager' },
  { value: 'creative', label: 'Creative' },
  { value: 'public_relation', label: 'Public Relation' },
  { value: 'admin_marketplace', label: 'Admin Marketplace' },
  { value: 'rnd', label: 'R&D' },
  { value: 'admin', label: 'Admin' },
];

export default function PengaturanPage() {
  const [activeTab, setActiveTab] = useState('Brand');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kpiConfigs, setKpiConfigs] = useState<KpiConfig[]>([]);
  const [selectedBrandForKpi, setSelectedBrandForKpi] = useState('');
  const [toast, setToast] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: '', description: '', status: 'active' });
  const [userForm, setUserForm] = useState({ email: '', full_name: '', role: 'creative', brand_id: '', password: 'zaneva123' });
  const [kpiForm, setKpiForm] = useState({ name: '', category: 'manual', unit: 'currency', description: '' });
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then(setBrands);
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }, []);

  useEffect(() => {
    if (selectedBrandForKpi) {
      fetch(`/api/kpi-monitor/items?brand_id=${selectedBrandForKpi}`)
        .then(r => r.json()).then(setKpiConfigs);
    }
  }, [selectedBrandForKpi]);

  async function handleCreateBrand() {
    setSaving(true);
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandForm),
    });
    setSaving(false);
    if (res.ok) {
      showToast('✅ Brand berhasil ditambahkan');
      setBrandForm({ name: '', description: '', status: 'active' });
      setShowBrandModal(false);
      fetch('/api/brands').then(r => r.json()).then(setBrands);
    }
  }

  async function handleToggleBrand(id: string, status: string) {
    const newStatus = status === 'active' ? 'inactive' : 'active';
    await fetch(`/api/brands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(`Brand ${newStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}`);
    fetch('/api/brands').then(r => r.json()).then(setBrands);
  }

  async function handleCreateUser() {
    setSaving(true);
    const brand = brands.find(b => b.id === userForm.brand_id);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userForm, brand_name: brand?.name || null }),
    });
    setSaving(false);
    if (res.ok) {
      showToast('✅ User berhasil ditambahkan');
      setUserForm({ email: '', full_name: '', role: 'creative', brand_id: '', password: 'zaneva123' });
      setShowUserModal(false);
      fetch('/api/users').then(r => r.json()).then(setUsers);
    } else {
      const d = await res.json();
      showToast(`❌ ${d.error || 'Gagal membuat user'}`);
    }
  }

  async function handleToggleKpi(kpiItemId: string, isEnabled: boolean) {
    await fetch('/api/kpi-monitor/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: selectedBrandForKpi, kpi_item_id: kpiItemId, is_enabled: !isEnabled }),
    });
    fetch(`/api/kpi-monitor/items?brand_id=${selectedBrandForKpi}`)
      .then(r => r.json()).then(setKpiConfigs);
    showToast(`KPI ${!isEnabled ? 'diaktifkan' : 'dinonaktifkan'}`);
  }

  async function handleCreateKpi() {
    setSaving(true);
    const res = await fetch('/api/kpi-monitor/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kpiForm),
    });
    setSaving(false);
    if (res.ok) {
      showToast('✅ Master KPI berhasil ditambahkan');
      setKpiForm({ name: '', category: 'manual', unit: 'currency', description: '' });
      setShowKpiModal(false);
      // Refresh current brand KPI configs if a brand is selected so it auto-syncs
      if (selectedBrandForKpi) {
        fetch(`/api/kpi-monitor/items?brand_id=${selectedBrandForKpi}`)
          .then(r => r.json()).then(setKpiConfigs);
      }
    } else {
      const d = await res.json();
      showToast(`❌ ${d.error || 'Gagal membuat KPI'}`);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Pengaturan</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Konfigurasi brand, tim, dan KPI</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: activeTab === tab ? 'var(--gold)' : 'transparent', color: activeTab === tab ? '#0A0E1A' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* BRAND TAB */}
      {activeTab === 'Brand' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowBrandModal(true)}>+ Tambah Brand</button>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Brand</th><th>Deskripsi</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {brands.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, color: 'var(--gold)' }}>{b.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{b.description || '—'}</td>
                    <td><span className={`badge ${b.status === 'active' ? 'status-on-track' : 'status-behind'}`}>{b.status}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleToggleBrand(b.id, b.status)}>
                        {b.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showBrandModal && (
            <Modal title="Tambah Brand" onClose={() => setShowBrandModal(false)}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Nama Brand *</label>
                  <input className="input" value={brandForm.name} onChange={e => setBrandForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Zaneva" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Deskripsi</label>
                  <input className="input" value={brandForm.description} onChange={e => setBrandForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi singkat brand" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowBrandModal(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={handleCreateBrand} disabled={saving || !brandForm.name}>Tambah Brand</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* TIM TAB */}
      {activeTab === 'Tim' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>+ Tambah Anggota</button>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Brand</th><th>Status</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'monospace' }}>{u.email}</td>
                    <td><span className={`badge ${ROLE_CLASS[u.role] || 'role-owner'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td style={{ color: 'var(--gold)', fontSize: 13 }}>{u.brand_name || '(Semua)'}</td>
                    <td><span className={`badge ${u.is_active ? 'status-on-track' : 'status-behind'}`} style={{ fontSize: 9 }}>{u.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showUserModal && (
            <Modal title="Tambah Anggota Tim" onClose={() => setShowUserModal(false)}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Nama Lengkap *</label>
                    <input className="input" value={userForm.full_name} onChange={e => setUserForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Nama" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Email *</label>
                    <input className="input" type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="email@zaneva.id" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Role *</label>
                    <select className="input" value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Brand</label>
                    <select className="input" value={userForm.brand_id} onChange={e => setUserForm(p => ({ ...p, brand_id: e.target.value }))}>
                      <option value="">— Pilih brand —</option>
                      {brands.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Password Default</label>
                  <input className="input" type="text" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>User bisa ganti password setelah login pertama (fitur reset manual)</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={handleCreateUser} disabled={saving || !userForm.full_name || !userForm.email}>Tambah User</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* KPI CONFIG TAB */}
      {activeTab === 'KPI Config' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Pilih Brand untuk Konfigurasi KPI</label>
                <select className="input" style={{ width: 'auto' }} value={selectedBrandForKpi} onChange={e => setSelectedBrandForKpi(e.target.value)}>
                  <option value="">— Pilih brand —</option>
                  {brands.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowKpiModal(true)}>+ Tambah Master KPI</button>
          </div>

          {selectedBrandForKpi && (
            <div className="card">
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Toggle KPI yang ingin dimonitor untuk brand ini. KPI yang dinonaktifkan tidak akan muncul di Monitor KPI dan Weekly Report.</p>
              <table className="table">
                <thead><tr><th>KPI</th><th>Unit</th><th>Tipe</th><th>Deskripsi</th><th>Aktif</th></tr></thead>
                <tbody>
                  {kpiConfigs.map(c => (
                    <tr key={c.kpi_item_id}>
                      <td style={{ fontWeight: 500 }}>{c.kpi_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.kpi_item.unit}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.kpi_item.category.replace('_', ' ')}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.kpi_item.description || '—'}</td>
                      <td>
                        <button
                          onClick={() => handleToggleKpi(c.kpi_item_id, c.is_enabled)}
                          style={{
                            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: c.is_enabled ? 'var(--green)' : 'var(--border)',
                            transition: 'background 0.2s', position: 'relative',
                          }}
                        >
                          <div style={{ position: 'absolute', top: 3, left: c.is_enabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showKpiModal && (
            <Modal title="Tambah Master KPI Baru" onClose={() => setShowKpiModal(false)}>
              <div style={{ display: 'grid', gap: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>KPI ini akan ditambahkan ke Kamus KPI dan bisa diaktifkan/dinonaktifkan untuk setiap brand.</p>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Nama KPI *</label>
                  <input className="input" value={kpiForm.name} onChange={e => setKpiForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Omzet Offline" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Satuan *</label>
                    <select className="input" value={kpiForm.unit} onChange={e => setKpiForm(p => ({ ...p, unit: e.target.value }))}>
                      <option value="currency">Currency (Mata Uang)</option>
                      <option value="number">Number (Angka)</option>
                      <option value="percent">Percent (Persentase)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Tipe / Kategori *</label>
                    <select className="input" value={kpiForm.category} onChange={e => setKpiForm(p => ({ ...p, category: e.target.value }))}>
                      <option value="manual">Manual (Input Bebas)</option>
                      <option value="auto_daily_log">Auto dari Daily Log</option>
                      <option value="auto_sum">Auto Sum (Agregasi)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Deskripsi</label>
                  <input className="input" value={kpiForm.description} onChange={e => setKpiForm(p => ({ ...p, description: e.target.value }))} placeholder="Penjelasan singkat tentang KPI ini" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setShowKpiModal(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={handleCreateKpi} disabled={saving || !kpiForm.name}>Simpan ke Kamus KPI</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}
