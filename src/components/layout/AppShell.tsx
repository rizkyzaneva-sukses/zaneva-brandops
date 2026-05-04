'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SessionUser } from '@/lib/session';
import { ROLE_LABELS, ROLE_CLASS, canAccess } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⬛', roles: ['all'] },
  { path: '/standup', label: 'Daily Sprint', icon: '⚡', roles: ['all'] },
  { path: '/reports', label: 'Laporan Harian', icon: '📄', roles: ['all'] },
  { path: '/weekly-report', label: 'Weekly Report', icon: '📅', roles: ['owner', 'admin', 'brand_manager'] },
  { path: '/monthly-report', label: 'Monthly Report', icon: '📊', roles: ['owner', 'admin', 'brand_manager'] },
  { path: '/kpi-target', label: 'Target KPI', icon: '🎯', roles: ['owner', 'admin'] },
  { path: '/kpi-monitor', label: 'Monitor KPI', icon: '📈', roles: ['owner', 'admin', 'brand_manager'] },
  { path: '/standup-history', label: 'History Sprint', icon: '🕐', roles: ['all'] },
  { path: '/individual-report', label: 'Laporan Kinerja', icon: '👥', roles: ['owner', 'admin', 'brand_manager'] },
  { path: '/guide', label: 'Panduan', icon: '📖', roles: ['all'] },
  { path: '/pengaturan', label: 'Pengaturan', icon: '⚙️', roles: ['owner', 'admin', 'brand_manager'] },
];

export default function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const visibleNav = NAV_ITEMS.filter(item => canAccess(user.role, item.roles));

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Konfirmasi password tidak cocok');
      return;
    }

    if (pwForm.new_password.length < 6) {
      setPwError('Password baru minimal 6 karakter');
      return;
    }

    setPwLoading(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
    });

    const data = await res.json();
    setPwLoading(false);

    if (!res.ok) {
      setPwError(data.error || 'Gagal mengubah password');
    } else {
      setPwSuccess('Password berhasil diubah!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => { setShowPasswordModal(false); setPwSuccess(''); }, 2000);
    }
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--gold), var(--gold-light))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0A0E1A', flexShrink: 0 }}>Z</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>ZANEVA</div>
            <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>BrandOps</div>
          </div>
        </div>
      </div>

      {/* Brand pill */}
      {user.brand_name && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Brand: </span>
          <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{user.brand_name}</span>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {visibleNav.map(item => {
          const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              style={{ marginBottom: 2, display: 'flex' }}
              onClick={() => setSidebarOpen(false)}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontSize: 13 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{user.full_name}</div>
          <span className={`badge ${ROLE_CLASS[user.role] || 'role-owner'}`} style={{ fontSize: 10 }}>
            {ROLE_LABELS[user.role] || user.role}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowPasswordModal(true); setPwError(''); setPwSuccess(''); setPwForm({ current_password: '', new_password: '', confirm_password: '' }); }} style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>
            🔑 Ganti Password
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}>
            🚪 Keluar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Desktop Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, display: 'none' }} className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside style={{ position: 'fixed', top: 0, left: sidebarOpen ? 0 : -260, bottom: 0, width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', zIndex: 300, transition: 'left 0.3s ease' }}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minHeight: '100vh', overflowX: 'hidden' }} className="main-content">
        {/* Mobile header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 20, padding: '4px 8px' }}>☰</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>ZANEVA BrandOps</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.full_name.split(' ')[0]}</div>
        </header>

        <div style={{ padding: '24px 20px', maxWidth: 1280, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>🔑 Ganti Password</h2>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <form onSubmit={handleChangePassword} style={{ padding: 24 }}>
              {pwError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#FCA5A5', fontSize: 13 }}>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#86EFAC', fontSize: 13 }}>
                  ✅ {pwSuccess}
                </div>
              )}
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Password Lama *</label>
                  <input className="input" type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} placeholder="Masukkan password lama" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Password Baru *</label>
                  <input className="input" type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} placeholder="Minimal 6 karakter" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Konfirmasi Password Baru *</label>
                  <input className="input" type="password" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} placeholder="Ulangi password baru" required />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                    {pwLoading ? 'Menyimpan...' : 'Simpan Password'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop { display: block !important; }
          .main-content { margin-left: 220px; }
          .mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
