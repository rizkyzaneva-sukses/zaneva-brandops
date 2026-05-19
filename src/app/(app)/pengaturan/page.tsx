'use client';

import { useState, useEffect } from 'react';
import { ROLE_LABELS, ROLE_CLASS } from '@/lib/utils';
import { DEFAULT_DAILY_SCHEDULE, parseDailySchedule, serializeDailySchedule } from '@/lib/telegramSchedule';

interface Brand { id: string; name: string; description: string; status: string; }
interface User { id: string; email: string; full_name: string; role: string; brand_id: string | null; brand_name: string | null; is_active: boolean; }
interface KpiConfig { kpi_item_id: string; kpi_name: string; is_enabled: boolean; kpi_item: { unit: string; category: string; description: string | null; auto_source_role?: string | null; order_num: number; higher_is_better?: boolean }; }
interface ImportSummary {
  source_file: string;
  imported_user_emails: string[];
  skipped: { type: string; id: string; reason: string; replacement_id?: string }[];
  counts: Record<string, number>;
  default_password_for_imported_users: string;
  imported_users_active: boolean;
}

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'brand_manager', label: 'Brand Manager' },
  { value: 'creative', label: 'Creative' },
  { value: 'public_relation', label: 'Public Relation' },
  { value: 'admin_marketplace', label: 'Admin Marketplace' },
  { value: 'rnd', label: 'R&D' },
  { value: 'admin', label: 'Admin' },
];

const DEFAULT_TELEGRAM_FORM = {
  id: '',
  name: '',
  bot_token: '',
  chat_id: '',
  topic_daily: '',
  topic_weekly: '',
  daily_pic_dwi_chat_id: '',
  daily_pic_kania_chat_id: '',
  is_active: true,
  schedule_daily: serializeDailySchedule(DEFAULT_DAILY_SCHEDULE),
  schedule_weekly: '10:30',
};

function updateDailyScheduleValue(value: string, session: 'pagi' | 'sore', time: string) {
  return serializeDailySchedule({ ...parseDailySchedule(value), [session]: time });
}

export default function PengaturanPage() {
  const [activeTab, setActiveTab] = useState('Brand');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kpiConfigs, setKpiConfigs] = useState<KpiConfig[]>([]);
  const [selectedBrandForKpi, setSelectedBrandForKpi] = useState('');
  const [toast, setToast] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: '', description: '', status: 'active' });
  const [userForm, setUserForm] = useState({ email: '', full_name: '', role: 'creative', brand_id: '', password: 'zaneva123' });
  const [editUserForm, setEditUserForm] = useState({ id: '', full_name: '' });
  const [kpiForm, setKpiForm] = useState<{ name: string; category: string; unit: string; description: string; auto_source_role: string; auto_sum_formula?: string; auto_sum_kpi_names?: string; higher_is_better: boolean }>({ name: '', category: 'manual', unit: 'currency', description: '', auto_source_role: '', auto_sum_formula: 'all_currency', auto_sum_kpi_names: '', higher_is_better: true });
  const [editKpiId, setEditKpiId] = useState<string | null>(null);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<User | null>(null);
  const [resetPwValue, setResetPwValue] = useState('zaneva123');
  const [resetPwMsg, setResetPwMsg] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Telegram state
  const [telegramConfigs, setTelegramConfigs] = useState<{ id: string; name: string; bot_token: string; chat_id: string; topic_daily: string; topic_weekly: string; daily_pic_dwi_chat_id: string | null; daily_pic_kania_chat_id: string | null; is_active: boolean; schedule_daily: string; schedule_weekly: string }[]>([]);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramForm, setTelegramForm] = useState(DEFAULT_TELEGRAM_FORM);
  const [telegramSending, setTelegramSending] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUser(d.user));
    fetch('/api/brands').then(r => r.json()).then(setBrands);
    fetch('/api/users').then(r => r.json()).then(setUsers);
    fetch('/api/telegram/config').then(r => r.ok ? r.json() : []).then(setTelegramConfigs);
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
    try {
      setSaving(true);
      const brand = brands.find(b => b.id === userForm.brand_id);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userForm, brand_name: brand?.name || null }),
      });

      const data = await res.json().catch(() => ({ error: 'Gagal membuat user' }));

      if (res.ok) {
        showToast('✅ User berhasil ditambahkan');
        setUserForm({ email: '', full_name: '', role: 'creative', brand_id: '', password: 'zaneva123' });
        setShowUserModal(false);
        fetch('/api/users').then(r => r.json()).then(setUsers);
      } else {
        showToast(`❌ ${data.error || 'Gagal membuat user'}`);
      }
    } catch (error) {
      console.error('Create user UI error:', error);
      showToast('❌ Gagal membuat user');
    } finally {
      setSaving(false);
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

  async function handleSaveKpi() {
    setSaving(true);
    const isEdit = !!editKpiId;
    const payload = {
      ...(isEdit ? { id: editKpiId } : {}),
      name: kpiForm.name,
      category: kpiForm.category,
      unit: kpiForm.unit,
      description: kpiForm.description,
      auto_source_role: kpiForm.auto_source_role,
      auto_sum_formula: kpiForm.auto_sum_formula,
      auto_sum_kpi_names: kpiForm.auto_sum_kpi_names,
      higher_is_better: kpiForm.higher_is_better,
    };
    const res = await fetch('/api/kpi-monitor/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      showToast(`✅ Master KPI berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}`);
      setKpiForm({ name: '', category: 'manual', unit: 'currency', description: '', auto_source_role: '', auto_sum_formula: 'all_currency', auto_sum_kpi_names: '', higher_is_better: true });
      setEditKpiId(null);
      setShowKpiModal(false);
      // Refresh current brand KPI configs if a brand is selected so it auto-syncs
      if (selectedBrandForKpi) {
        fetch(`/api/kpi-monitor/items?brand_id=${selectedBrandForKpi}`)
          .then(r => r.json()).then(setKpiConfigs);
      }
    } else {
      const d = await res.json();
      showToast(`❌ ${d.error || 'Gagal menyimpan KPI'}`);
    }
  }

  function openEditKpiModal(c: KpiConfig) {
    setEditKpiId(c.kpi_item_id);
    setKpiForm({
      name: c.kpi_name,
      category: c.kpi_item.category,
      unit: c.kpi_item.unit,
      description: c.kpi_item.description || '',
      auto_source_role: c.kpi_item.auto_source_role || '',
      higher_is_better: c.kpi_item.higher_is_better !== false,
    });
    setShowKpiModal(true);
  }

  async function handleDeleteKpi(kpiItemId: string, kpiName: string) {
    if (!confirm(`Yakin ingin menghapus KPI "${kpiName}"? Data terkait (target, snapshot) juga akan dihapus.`)) return;
    const res = await fetch(`/api/kpi-monitor/items?id=${kpiItemId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`✅ KPI "${kpiName}" berhasil dihapus`);
      if (selectedBrandForKpi) {
        fetch(`/api/kpi-monitor/items?brand_id=${selectedBrandForKpi}`)
          .then(r => r.json()).then(setKpiConfigs);
      }
    } else {
      const d = await res.json();
      showToast(`❌ ${d.error || 'Gagal menghapus KPI'}`);
    }
  }

  async function handleMoveKpi(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= kpiConfigs.length) return;
    const newConfigs = [...kpiConfigs];
    const [moved] = newConfigs.splice(fromIndex, 1);
    newConfigs.splice(toIndex, 0, moved);
    setKpiConfigs(newConfigs);

    // Save new order to backend
    const items = newConfigs.map((c, idx) => ({ id: c.kpi_item_id, order_num: idx + 1 }));
    const res = await fetch('/api/kpi-monitor/items/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      showToast('✅ Urutan KPI berhasil diperbarui');
    } else {
      showToast('❌ Gagal menyimpan urutan');
      // Revert on failure
      fetch(`/api/kpi-monitor/items?brand_id=${selectedBrandForKpi}`)
        .then(r => r.json()).then(setKpiConfigs);
    }
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: any, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDragEnd() {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      handleMoveKpi(dragIdx, dragOverIdx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }

  async function handleResetPassword() {
    if (!resetPwUser) return;
    setSaving(true);
    setResetPwMsg('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: resetPwUser.id, new_password: resetPwValue }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setResetPwMsg(`✅ ${data.message}`);
      setTimeout(() => { setShowResetPwModal(false); setResetPwMsg(''); }, 2000);
    } else {
      setResetPwMsg(`❌ ${data.error || 'Gagal reset password'}`);
    }
  }

  async function handleToggleUserStatus(userId: string, currentStatus: boolean) {
    setTogglingUserId(userId);
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentStatus }),
    });
    setTogglingUserId(null);
    if (res.ok) {
      showToast(`✅ User berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetch('/api/users').then(r => r.json()).then(setUsers);
    } else {
      const data = await res.json();
      showToast(`❌ ${data.error || 'Gagal mengubah status'}`);
    }
  }

  function openEditUserModal(user: User) {
    setEditUserForm({ id: user.id, full_name: user.full_name });
    setShowEditUserModal(true);
  }

  async function handleEditUserName() {
    if (!editUserForm.id || !editUserForm.full_name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/users/${editUserForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editUserForm.full_name.trim() }),
    });
    const data = await res.json().catch(() => ({ error: 'Gagal mengubah nama user' }));
    setSaving(false);
    if (res.ok) {
      showToast('✅ Nama user berhasil diperbarui');
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, full_name: data.full_name } : u));
      if (currentUser?.id === data.id) {
        setCurrentUser(prev => prev ? { ...prev, full_name: data.full_name } : prev);
      }
      setShowEditUserModal(false);
      setEditUserForm({ id: '', full_name: '' });
    } else {
      showToast(`❌ ${data.error || 'Gagal mengubah nama user'}`);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setSaving(true);
    const res = await fetch(`/api/users/${deleteUser.id}`, { method: 'DELETE' });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      showToast(`✅ ${data.message}`);
      setShowDeleteModal(false);
      setDeleteUser(null);
      fetch('/api/users').then(r => r.json()).then(setUsers);
    } else {
      showToast(`❌ ${data.error || 'Gagal menghapus user'}`);
    }
  }

  async function handleGenerateDummy() {
    if (!confirm('Apakah Anda yakin ingin membuat data dummy? Data lama TIDAK akan terhapus, tapi ini akan memenuhi database Anda.')) return;
    setSaving(true);
    const res = await fetch('/api/admin/dummy-data', { method: 'POST' });
    setSaving(false);
    if (res.ok) {
      showToast('✅ Dummy data berhasil di-generate!');
    } else {
      showToast('❌ Gagal generate dummy data');
    }
  }

  async function handleResetData() {
    if (!confirm('AWAS! Ini akan MENGHAPUS SEMUA DATA TRANSAKSI (Standup, Report Mingguan, dsb). Master data (Brand, User, KPI) akan aman. Yakin?')) return;
    const confirm2 = prompt('Ketik "HAPUS" untuk melanjutkan');
    if (confirm2 !== 'HAPUS') {
      showToast('Dibatalkan');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/reset-data', { method: 'POST' });
    setSaving(false);
    if (res.ok) {
      showToast('✅ Semua data transaksi berhasil di-reset!');
    } else {
      showToast('❌ Gagal mereset data');
    }
  }

  async function handleImportData() {
    if (!importFile) {
      showToast('❌ Pilih file JSON terlebih dahulu');
      return;
    }

    if (!confirm('Import ini akan sinkronkan master KPI, standup config, target KPI, dan data histori dari file JSON. Lanjutkan?')) return;

    const formData = new FormData();
    formData.append('file', importFile);

    setImporting(true);
    setImportSummary(null);

    const res = await fetch('/api/admin/import-data', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setImporting(false);

    if (!res.ok) {
      showToast(`❌ ${data.error || 'Import gagal'}`);
      return;
    }

    setImportSummary(data);
    showToast('✅ Data berhasil diimport');
    fetch('/api/brands').then(r => r.json()).then(setBrands);
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }

  // Telegram functions
  async function handleSaveTelegram() {
    setSaving(true);
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramForm),
    });
    setSaving(false);
    if (res.ok) {
      showToast('✅ Konfigurasi Telegram tersimpan');
      setShowTelegramModal(false);
      setTelegramForm(DEFAULT_TELEGRAM_FORM);
      fetch('/api/telegram/config').then(r => r.ok ? r.json() : []).then(setTelegramConfigs);
    } else {
      showToast('❌ Gagal menyimpan');
    }
  }

  async function handleDeleteTelegram(id: string) {
    if (!confirm('Hapus konfigurasi Telegram ini?')) return;
    await fetch(`/api/telegram/config?id=${id}`, { method: 'DELETE' });
    showToast('Konfigurasi dihapus');
    fetch('/api/telegram/config').then(r => r.ok ? r.json() : []).then(setTelegramConfigs);
  }

  async function handleTestTelegram(id: string) {
    setTelegramSending(id);
    const res = await fetch('/api/telegram/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setTelegramSending(null);
    const botInfo = data.bot_name ? ` [Bot: ${data.bot_name}]` : '';
    const chatInfo = data.chat_title ? ` [Chat: ${data.chat_title}]` : data.chat_error ? ` [Chat: ${data.chat_error}]` : '';
    if (data.group_ok) {
      const picInfo = data.pic_results?.length
        ? ` | PIC: ${data.pic_results.map((p: { ok: boolean }) => p.ok ? '✅' : '❌').join(' ')}`
        : '';
      showToast(`✅ Terkirim${picInfo}${botInfo}`);
    } else {
      showToast(`❌ ${data.group_error || 'Gagal'}${botInfo}${chatInfo}`);
    }
  }

  async function handleTriggerDaily(session: 'pagi' | 'sore') {
    setSaving(true);
    const res = await fetch(`/api/telegram/daily-summary?session=${session}`, { method: 'POST' });
    const data = await res.json();
    setSaving(false);
    showToast(data.ok ? `✅ Report sprint ${session} terkirim (${data.group_sent} group, ${data.pic_sent} PIC)` : '❌ Gagal mengirim');
  }

  async function handleTriggerWeekly() {
    setSaving(true);
    const res = await fetch('/api/telegram/weekly-report', { method: 'POST' });
    const data = await res.json();
    setSaving(false);
    showToast(data.ok ? `✅ Weekly report terkirim (${data.sent} destinasi)` : `❌ ${data.error || 'Gagal mengirim'}`);
  }

  const tabs = currentUser?.role === 'owner' ? ['Brand', 'Tim', 'KPI Config', 'Telegram', 'Sistem (Owner)'] : ['Brand', 'Tim', 'KPI Config'];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Pengaturan</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Konfigurasi brand, tim, dan KPI</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {tabs.map(tab => (
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
              <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Brand</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'monospace' }}>{u.email}</td>
                    <td><span className={`badge ${ROLE_CLASS[u.role] || 'role-owner'}`} style={{ fontSize: 9 }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td style={{ color: 'var(--gold)', fontSize: 13 }}>{u.brand_name || '(Semua)'}</td>
                    <td>
                      {currentUser?.role === 'owner' && u.id !== currentUser.id ? (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                          disabled={togglingUserId === u.id}
                          title={u.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                          style={{
                            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: u.is_active ? 'var(--green)' : 'var(--border)',
                            transition: 'background 0.2s', position: 'relative',
                            opacity: togglingUserId === u.id ? 0.5 : 1,
                          }}
                        >
                          <div style={{ position: 'absolute', top: 3, left: u.is_active ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                        </button>
                      ) : (
                        <span className={`badge ${u.is_active ? 'status-on-track' : 'status-behind'}`} style={{ fontSize: 9 }}>{u.is_active ? 'Aktif' : 'Nonaktif'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {currentUser && ['owner', 'admin'].includes(currentUser.role) && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setResetPwUser(u); setResetPwValue('zaneva123'); setResetPwMsg(''); setShowResetPwModal(true); }}>
                            🔑 Reset PW
                          </button>
                        )}
                        {currentUser?.role === 'owner' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => openEditUserModal(u)}
                          >
                            ✏️ Edit Nama
                          </button>
                        )}
                        {currentUser?.role === 'owner' && u.id !== currentUser.id && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: '#EF4444' }}
                            onClick={() => { setDeleteUser(u); setShowDeleteModal(true); }}
                          >
                            🗑 Hapus
                          </button>
                        )}
                      </div>
                    </td>
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
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>User bisa ganti password sendiri setelah login (via tombol 🔑 Ganti Password di sidebar)</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Batal</button>
                  <button type="button" className="btn btn-primary" onClick={handleCreateUser} disabled={saving || !userForm.full_name.trim() || !userForm.email.trim()}>
                    {saving ? 'Menyimpan...' : 'Tambah User'}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {showEditUserModal && (
            <Modal title="Edit Nama User" onClose={() => setShowEditUserModal(false)}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Nama Lengkap *</label>
                  <input
                    className="input"
                    value={editUserForm.full_name}
                    onChange={e => setEditUserForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nama user"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowEditUserModal(false);
                      setEditUserForm({ id: '', full_name: '' });
                    }}
                  >
                    Batal
                  </button>
                  <button className="btn btn-primary" onClick={handleEditUserName} disabled={saving || !editUserForm.full_name.trim()}>
                    {saving ? 'Menyimpan...' : 'Simpan Nama'}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Reset Password Modal */}
          {showResetPwModal && resetPwUser && (
            <Modal title={`Reset Password: ${resetPwUser.full_name}`} onClose={() => setShowResetPwModal(false)}>
              <div style={{ display: 'grid', gap: 14 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Reset password untuk <strong>{resetPwUser.email}</strong>. User akan menggunakan password baru ini untuk login.
                </p>
                {resetPwMsg && (
                  <div style={{ background: resetPwMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${resetPwMsg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 14px', color: resetPwMsg.startsWith('✅') ? '#86EFAC' : '#FCA5A5', fontSize: 13 }}>
                    {resetPwMsg}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Password Baru *</label>
                  <input className="input" type="text" value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} placeholder="Minimal 6 karakter" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setShowResetPwModal(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={handleResetPassword} disabled={saving || resetPwValue.length < 6}>
                    {saving ? 'Menyimpan...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Delete User Modal */}
          {showDeleteModal && deleteUser && (
            <Modal title="Hapus User" onClose={() => { setShowDeleteModal(false); setDeleteUser(null); }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>
                    ⚠️ <strong>Perhatian!</strong> Menghapus user akan menghapus SEMUA data terkait (standup, laporan harian). Aksi ini tidak bisa dibatalkan.
                  </p>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Yakin ingin menghapus user <strong style={{ color: '#EF4444' }}>{deleteUser.full_name}</strong> ({deleteUser.email})?
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteUser(null); }}>Batal</button>
                  <button className="btn" style={{ background: '#EF4444', color: 'white', border: 'none' }} onClick={handleDeleteUser} disabled={saving}>
                    {saving ? 'Menghapus...' : '🗑 Hapus Permanen'}
                  </button>
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
            <button className="btn btn-primary" onClick={() => { setEditKpiId(null); setKpiForm({ name: '', category: 'manual', unit: 'currency', description: '', auto_source_role: '', auto_sum_formula: 'all_currency', auto_sum_kpi_names: '', higher_is_better: true }); setShowKpiModal(true); }}>+ Tambah Master KPI</button>
          </div>

          {selectedBrandForKpi && (
            <div className="card">
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Toggle KPI yang ingin dimonitor untuk brand ini. Drag atau gunakan tombol ↑↓ untuk mengatur urutan tampilan KPI.</p>
              <table className="table">
                <thead><tr><th style={{ width: 60 }}>Urutan</th><th>KPI</th><th>Unit</th><th>Tipe</th><th>Aktif</th><th>Aksi</th></tr></thead>
                <tbody>
                  {kpiConfigs.map((c, idx) => (
                    <tr
                      key={c.kpi_item_id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      style={{
                        cursor: 'grab',
                        opacity: dragIdx === idx ? 0.5 : 1,
                        background: dragOverIdx === idx ? 'rgba(212,175,55,0.1)' : undefined,
                        borderLeft: dragOverIdx === idx ? '3px solid var(--gold)' : '3px solid transparent',
                        transition: 'background 0.15s, border-left 0.15s',
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <button
                            onClick={() => handleMoveKpi(idx, idx - 1)}
                            disabled={idx === 0}
                            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--border)' : 'var(--text-secondary)', fontSize: 14, padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}
                            title="Pindah ke atas"
                          >▲</button>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, userSelect: 'none' }}>☰</span>
                          <button
                            onClick={() => handleMoveKpi(idx, idx + 1)}
                            disabled={idx === kpiConfigs.length - 1}
                            style={{ background: 'none', border: 'none', cursor: idx === kpiConfigs.length - 1 ? 'not-allowed' : 'pointer', color: idx === kpiConfigs.length - 1 ? 'var(--border)' : 'var(--text-secondary)', fontSize: 14, padding: '2px 6px', borderRadius: 4, lineHeight: 1 }}
                            title="Pindah ke bawah"
                          >▼</button>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.kpi_name}</div>
                        {c.kpi_item.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.kpi_item.description}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.kpi_item.unit}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.kpi_item.category.replace('_', ' ')}</td>
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
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditKpiModal(c)} style={{ padding: '4px 8px', fontSize: 12 }}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteKpi(c.kpi_item_id, c.kpi_name)} style={{ padding: '4px 8px', fontSize: 12, color: '#EF4444' }}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showKpiModal && (
            <Modal title={editKpiId ? "Edit Master KPI" : "Tambah Master KPI Baru"} onClose={() => setShowKpiModal(false)}>
              <div style={{ display: 'grid', gap: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>KPI ini ada di Kamus KPI dan bisa diaktifkan/dinonaktifkan untuk setiap brand. {editKpiId && 'Perubahan di sini akan berdampak ke semua brand yang menggunakan KPI ini.'}</p>
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

                {kpiForm.category === 'auto_sum' && (
                  <div style={{ padding: '10px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    💡 KPI bertipe <b>Auto Sum</b> akan otomatis menjumlahkan KPI dari Daily Log Sore yang di-assign ke tim. Anda bisa memilih rumus spesifik di bawah.
                  </div>
                )}

                {kpiForm.category === 'auto_sum' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Rumus Agregasi</label>
                    <select className="input" value={kpiForm.auto_sum_formula || 'all_currency'} onChange={e => setKpiForm(p => ({ ...p, auto_sum_formula: e.target.value }))}>
                      <option value="all_currency">Semua KPI Auto Daily Log bersatuan Currency</option>
                      <option value="all_number">Semua KPI Auto Daily Log bersatuan Number</option>
                      <option value="by_role">Semua KPI Auto Daily Log dari Role tertentu</option>
                      <option value="custom">Pilih KPI spesifik (custom)</option>
                    </select>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Tentukan sumber data yang akan dijumlahkan secara otomatis.</p>
                  </div>
                )}

                {kpiForm.category === 'auto_sum' && (kpiForm.auto_sum_formula === 'by_role' || kpiForm.auto_sum_formula === 'custom') && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                      {kpiForm.auto_sum_formula === 'by_role' ? 'Filter berdasarkan Role' : 'Pilih KPI yang dijumlahkan'}
                    </label>
                    {kpiForm.auto_sum_formula === 'by_role' && (
                      <select className="input" value={kpiForm.auto_source_role} onChange={e => setKpiForm(p => ({ ...p, auto_source_role: e.target.value }))}>
                        <option value="">— Pilih Role —</option>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                    {kpiForm.auto_sum_formula === 'custom' && (
                      <input className="input" value={kpiForm.auto_sum_kpi_names || ''} onChange={e => setKpiForm(p => ({ ...p, auto_sum_kpi_names: e.target.value }))} placeholder="Nama KPI dipisah koma, e.g. Omzet Shopee, Omzet TikTok" />
                    )}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Ditugaskan ke (Role) *</label>
                  <select className="input" value={kpiForm.auto_source_role} onChange={e => setKpiForm(p => ({ ...p, auto_source_role: e.target.value }))}>
                    <option value="">— Pilih Role —</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {kpiForm.category === 'auto_daily_log'
                      ? 'Role ini yang akan melihat kolom inputan KPI ini di form Sprint Sore mereka.'
                      : kpiForm.category === 'auto_sum'
                        ? 'Role yang bertanggung jawab atas KPI agregasi ini.'
                        : 'Role yang bertanggung jawab mengisi KPI ini di Sprint Sore.'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Arah Target *</label>
                  <select className="input" value={kpiForm.higher_is_better ? 'true' : 'false'} onChange={e => setKpiForm(p => ({ ...p, higher_is_better: e.target.value === 'true' }))}>
                    <option value="true">↑ Semakin tinggi semakin baik (Omzet, ROAS, Order)</option>
                    <option value="false">↓ Semakin rendah semakin baik (Spending, Retur, Komplain)</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Menentukan apakah nilai KPI yang lebih tinggi berarti lebih baik atau lebih buruk.
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Deskripsi</label>
                  <input className="input" value={kpiForm.description} onChange={e => setKpiForm(p => ({ ...p, description: e.target.value }))} placeholder="Penjelasan singkat tentang KPI ini" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setShowKpiModal(false)}>Batal</button>
                  <button className="btn btn-primary" onClick={handleSaveKpi} disabled={saving || !kpiForm.name}>Simpan ke Kamus KPI</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* TELEGRAM TAB */}
      {activeTab === 'Telegram' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Destinasi Telegram</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kirim notifikasi harian & weekly ke Telegram Group + Topic</p>
            </div>
            <button className="btn btn-primary" onClick={() => { setTelegramForm(DEFAULT_TELEGRAM_FORM); setShowTelegramModal(true); }}>+ Tambah Destinasi</button>
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ marginBottom: 20, padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Kirim Manual</h4>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => handleTriggerDaily('pagi')} disabled={saving}>🌤️ Kirim Sprint Pagi</button>
              <button className="btn btn-ghost" onClick={() => handleTriggerDaily('sore')} disabled={saving}>🌆 Kirim Sprint Sore</button>
              <button className="btn btn-ghost" onClick={handleTriggerWeekly} disabled={saving}>📊 Kirim Weekly Report</button>
            </div>
          </div>

          {/* Config List */}
          <div className="card">
            {telegramConfigs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Belum ada konfigurasi Telegram. Klik &quot;+ Tambah Destinasi&quot; untuk mulai.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Nama</th><th>Chat ID</th><th>PIC Daily</th><th>Sprint Pagi</th><th>Sprint Sore</th><th>Jadwal Weekly</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {telegramConfigs.map(cfg => (
                    <tr key={cfg.id}>
                      <td style={{ fontWeight: 600 }}>{cfg.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cfg.chat_id}</td>
                      <td>{[cfg.daily_pic_dwi_chat_id, cfg.daily_pic_kania_chat_id].filter(Boolean).length}/2</td>
                      <td>{parseDailySchedule(cfg.schedule_daily).pagi} WIB</td>
                      <td>{parseDailySchedule(cfg.schedule_daily).sore} WIB</td>
                      <td>{cfg.schedule_weekly} WIB</td>
                      <td><span className={`badge ${cfg.is_active ? 'status-on-track' : 'status-behind'}`}>{cfg.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleTestTelegram(cfg.id)} disabled={telegramSending === cfg.id}>{telegramSending === cfg.id ? '...' : '🧪 Test'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setTelegramForm({ id: cfg.id, name: cfg.name, bot_token: cfg.bot_token, chat_id: cfg.chat_id, topic_daily: cfg.topic_daily || '', topic_weekly: cfg.topic_weekly || '', daily_pic_dwi_chat_id: cfg.daily_pic_dwi_chat_id || '', daily_pic_kania_chat_id: cfg.daily_pic_kania_chat_id || '', is_active: cfg.is_active, schedule_daily: serializeDailySchedule(parseDailySchedule(cfg.schedule_daily)), schedule_weekly: cfg.schedule_weekly }); setShowTelegramModal(true); }}>✏️</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTelegram(cfg.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Telegram Modal */}
          {showTelegramModal && (
            <Modal title={telegramForm.id ? 'Edit Destinasi Telegram' : 'Tambah Destinasi Telegram'} onClose={() => setShowTelegramModal(false)}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Nama Destinasi</label>
                  <input className="input" placeholder="e.g. Group Zaneva Ops" value={telegramForm.name} onChange={e => setTelegramForm({ ...telegramForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Bot Token</label>
                  <input className="input" placeholder="123456:ABC-DEF..." value={telegramForm.bot_token} onChange={e => setTelegramForm({ ...telegramForm, bot_token: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Chat ID (Group)</label>
                  <input className="input" placeholder="-1001234567890" value={telegramForm.chat_id} onChange={e => setTelegramForm({ ...telegramForm, chat_id: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Topic ID (Daily)</label>
                    <input className="input" placeholder="Thread ID untuk daily" value={telegramForm.topic_daily} onChange={e => setTelegramForm({ ...telegramForm, topic_daily: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Topic ID (Weekly)</label>
                    <input className="input" placeholder="Thread ID untuk weekly" value={telegramForm.topic_weekly} onChange={e => setTelegramForm({ ...telegramForm, topic_weekly: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Telegram ID Dwi Bintang Zaneva</label>
                    <input className="input" placeholder="Chat ID personal Dwi" value={telegramForm.daily_pic_dwi_chat_id} onChange={e => setTelegramForm({ ...telegramForm, daily_pic_dwi_chat_id: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Telegram ID Kania Zaneva</label>
                    <input className="input" placeholder="Chat ID personal Kania" value={telegramForm.daily_pic_kania_chat_id} onChange={e => setTelegramForm({ ...telegramForm, daily_pic_kania_chat_id: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Report Sprint Pagi (WIB)</label>
                    <input className="input" type="time" value={parseDailySchedule(telegramForm.schedule_daily).pagi} onChange={e => setTelegramForm({ ...telegramForm, schedule_daily: updateDailyScheduleValue(telegramForm.schedule_daily, 'pagi', e.target.value) })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Report Sprint Sore (WIB)</label>
                    <input className="input" type="time" value={parseDailySchedule(telegramForm.schedule_daily).sore} onChange={e => setTelegramForm({ ...telegramForm, schedule_daily: updateDailyScheduleValue(telegramForm.schedule_daily, 'sore', e.target.value) })} />
                  </div>
                </div>
                <div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Jadwal Weekly Senin (WIB)</label>
                    <input className="input" type="time" value={telegramForm.schedule_weekly} onChange={e => setTelegramForm({ ...telegramForm, schedule_weekly: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={telegramForm.is_active} onChange={e => setTelegramForm({ ...telegramForm, is_active: e.target.checked })} />
                  <label style={{ fontSize: 13 }}>Aktif</label>
                </div>
                <button className="btn btn-primary" onClick={handleSaveTelegram} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* SISTEM TAB */}
      {activeTab === 'Sistem (Owner)' && currentUser?.role === 'owner' && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.05)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#22C55E', marginBottom: 8 }}>Import Data JSON</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Upload file export lama untuk mengimpor brand, user histori, standup, daily report, konfigurasi sprint, dan KPI ke database aplikasi ini.
              User hasil impor akan dibuat dalam keadaan nonaktif supaya akses login tetap terkendali.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              <input
                className="input"
                type="file"
                accept=".json,application/json"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn" style={{ background: '#22C55E', color: '#04130A', border: 'none' }} onClick={handleImportData} disabled={importing || !importFile}>
                  {importing ? 'Mengimpor...' : 'Import Sekarang'}
                </button>
                {importFile && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{importFile.name}</span>}
              </div>
            </div>

            {importSummary && (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(10,14,26,0.35)' }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>File: <span style={{ color: 'var(--gold)' }}>{importSummary.source_file}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Record aktif setelah import:</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Object.entries(importSummary.counts).map(([key, value]) => (
                      <span key={key} className="badge status-on-track" style={{ fontSize: 11 }}>{key}: {value}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    User histori dari file: {importSummary.imported_user_emails.length} akun, status login {importSummary.imported_users_active ? 'aktif' : 'nonaktif'}.
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Record dilewati: {importSummary.skipped.length}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F59E0B', marginBottom: 8 }}>🛠 Generate Dummy Data</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Isi database dengan data bohongan (Standup Pagi/Sore, Weekly Report, Target KPI, dan Snapshot KPI harian).
              Gunakan ini untuk melihat bagaimana aplikasi bekerja dengan data penuh. Data asli tidak akan dihapus.
            </p>
            <button className="btn" style={{ background: '#F59E0B', color: 'white', border: 'none' }} onClick={handleGenerateDummy} disabled={saving}>
              {saving ? 'Loading...' : 'Generate Dummy Data'}
            </button>
          </div>

          <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#F97316', marginBottom: 8 }}>🗑 Hapus User Lama Zaneva</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Hapus permanen akun: <strong>Budi (Marketplace)</strong>, <strong>Ayu (R&D)</strong>, <strong>Dian (Creative)</strong>, <strong>Sari (BM)</strong>, <strong>Rini (PR)</strong> beserta seluruh sprint dan laporan mereka.
            </p>
            <button className="btn" style={{ background: '#F97316', color: 'white', border: 'none' }} onClick={async () => {
              if (!confirm('Hapus permanen 5 user Zaneva lama (Budi, Ayu, Dian, Sari, Rini) dan semua data mereka? Aksi ini tidak bisa dibatalkan.')) return;
              setSaving(true);
              const res = await fetch('/api/admin/remove-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails: ['marketplace.zaneva@zaneva.id', 'rnd.zaneva@zaneva.id', 'creative.zaneva@zaneva.id', 'bm.zaneva@zaneva.id', 'pr.zaneva@zaneva.id'] }),
              });
              const data = await res.json();
              setSaving(false);
              showToast(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
              if (res.ok) fetch('/api/users').then(r => r.json()).then(setUsers);
            }} disabled={saving}>
              {saving ? 'Menghapus...' : 'Hapus 5 User Zaneva'}
            </button>
          </div>

          <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#EF4444', marginBottom: 8 }}>⚠️ Hapus Semua Data Transaksi</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Menghapus <strong>SEMUA</strong> data operasional seperti Standup, Laporan Harian/Mingguan/Bulanan, serta data rekapan KPI.
              Master data (Brand, User, Kamus KPI) <strong>tidak akan dihapus</strong>.
              Gunakan ini sebelum benar-benar menggunakan aplikasi secara nyata (setelah selesai coba-coba dummy).
            </p>
            <button className="btn" style={{ background: '#EF4444', color: 'white', border: 'none' }} onClick={handleResetData} disabled={saving}>
              {saving ? 'Loading...' : 'Reset Data Transaksi'}
            </button>
          </div>
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
