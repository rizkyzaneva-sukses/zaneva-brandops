'use client';

import { useState } from 'react';
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

  const visibleNav = NAV_ITEMS.filter(item => canAccess(user.role, item.roles));

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
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
        <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
          🚪 Keluar
        </button>
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
