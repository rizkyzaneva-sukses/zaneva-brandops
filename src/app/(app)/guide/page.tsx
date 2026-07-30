'use client';

import { useState, useEffect } from 'react';
import { ROLE_LABELS } from '@/lib/utils';

const GUIDES: Record<string, { title: string; color: string; sections: { heading: string; content: string }[] }> = {
  all: {
    title: '🚀 Panduan Umum BrandOps',
    color: 'var(--gold)',
    sections: [
      {
        heading: 'Apa itu ZANEVA BrandOps?',
        content:
          'BrandOps adalah sistem operasional brand: captur angka harian (sprint), formalisasi mingguan/bulanan, freeze angka resmi, action items, dan portfolio Owner.\n\nBukan cuma form — tujuannya keputusan berbasis data yang bisa dieksekusi minggu berikutnya.',
      },
      {
        heading: 'Alur Resmi (yang dipakai di app)',
        content:
          '1. Pagi: Sprint Pagi (planning / hambatan)\n2. Sore: Sprint Sore + daily log metrik (sumber kebenaran angka)\n3. Live: Monitor KPI = agregasi real-time dari daily log\n4. Jumat: BM isi Weekly Report → Load Otomatis → cek action minggu lalu → action baru → narasi → Submit\n5. Setelah Submit: Monitor jadi FROZEN (angka resmi dari WR)\n6. Akhir bulan: Monthly Report auto-aggregate weekly submitted (sum omzet, avg ROAS)\n7. Owner: Portfolio multi-brand + tombol Review weekly/monthly\n\nPeriode minggu app: 1–7, 8–14, 15–21, 22–akhir bulan (bukan ISO week).',
      },
      {
        heading: 'Live vs Frozen (penting)',
        content:
          '• Live: belum ada Weekly Report submitted → angka dari sprint sore (real-time)\n• Frozen: Weekly Report status submitted/reviewed → Monitor memakai angka WR\n• Edit sprint setelah freeze TIDAK mengubah Monitor sampai WR diedit/dihapus\n• Toggle "Hari Ini" di Monitor selalu live (1 hari), tidak memakai freeze',
      },
      {
        heading: 'Cara baca angka',
        content:
          '• Target: format Rp 1.000.000 (pemisah titik)\n• Aktual input: sama, pakai pemisah ribuan ID\n• Score / status: pakai effective score (KPI lower-is-better seperti spend: over budget = merah)\n• Pace: mid-period bandingkan % aktual vs % kalender (hari berjalan). Behind pace = butuh Rp X/hari sisa minggu',
      },
      {
        heading: 'Tips mengisi sprint',
        content:
          '• Isi jujur & spesifik; angka aktual bukan estimasi\n• Hanya role sumber KPI yang dihitung (BM omzet, marketplace order, dll). Owner/admin hanya fallback jika role target kosong hari itu (tidak double-count)\n• Hari kosong tidak dihitung 0 pada KPI rata-rata (ROAS/rating)\n• Blocking issue tulis jelas agar bisa dieskalasi',
      },
      {
        heading: 'Telegram',
        content:
          '• Report Sprint Pagi/Sore: daftar yang belum submit (jadwal di Pengaturan → Telegram)\n• Weekly KPI blast: rekap performa per brand\n• PIC personal follow-up jika ada yang belum sprint\n• Daily & weekly boleh 1 group, topic berbeda',
      },
    ],
  },
  brand_manager: {
    title: '🎯 Panduan Brand Manager — Optimasi Report',
    color: '#F59E0B',
    sections: [
      {
        heading: 'Rutinitas harian (15 menit)',
        content:
          '1. Sprint Pagi: prioritas + hambatan\n2. Sprint Sore: daily log omzet / ROAS / campaign\n3. Buka Monitor KPI (Live): cek Pace — kalau Behind pace, intervensi hari itu (bukan tunggu Jumat)\n4. Follow action items open dari weekly lalu',
      },
      {
        heading: 'Weekly Report — langkah optimal (Jumat)',
        content:
          '1. Weekly Report → pilih brand & periode → Load Data Otomatis\n2. Bandingkan dengan Monitor (harus selaras sebelum submit)\n3. Step "Action Minggu Lalu": cek open/done/blocked — update status di meeting\n4. KPI behind (score efektif < 70%): wajib Root Cause + min 1 Action Item (judul + PIC)\n5. Max 3 action items minggu depan (spesifik, ada due date)\n6. Highlights / Lowlights singkat (fakta + 1 kalimat kenapa)\n7. Submit → Monitor FROZEN\n\nGate submit: sistem menolak submit kosong / tanpa root cause+action saat ada KPI behind.',
      },
      {
        heading: 'Script weekly review 30–45 menit',
        content:
          '0–3\' Opening: brand + minggu + tujuan 1 keputusan\n3–15\' Angka: target vs aktual + pace (bukan opini dulu)\n15–30\' Max 2 masalah → root cause\n30–40\' 3 action + PIC + due\n40–45\' Eskalasi Owner jika butuh budget/resource\n\nAturan: max 2 masalah, max 3 action, 1 nama per action.',
      },
      {
        heading: 'Monthly Report',
        content:
          '1. Pilih brand + bulan → Auto-aggregate dari weekly submitted\n2. Lihat N/4 weeks included — jujur jika belum lengkap\n3. Omzet/GMV/spend = SUM; ROAS/rating/aktif = AVG\n4. Overall score = rata-rata effective score\n5. Narasi strategis + Submit\n\nJangan re-sum ROAS 4 minggu (itu bug lama — sudah diperbaiki).',
      },
      {
        heading: 'Cara optimasi report biar impact bisnis',
        content:
          '• Satu sumber kebenaran: daily log → weekly freeze → monthly\n• Jangan rayakan % overspend (lower better = merah)\n• Action items > narasi panjang\n• Senin: buka action open dulu, baru daily log\n• Rabu: cek Pace di Monitor — intervensi dini\n• Jumat: formal WR + tutup loop action minggu lalu\n• Owner Review: minta status reviewed setelah diskusi',
      },
    ],
  },
  owner: {
    title: '👑 Panduan Owner — Portfolio & Review',
    color: '#94A3B8',
    sections: [
      {
        heading: 'Senin 10 menit — Portfolio',
        content:
          'Buka menu Portfolio:\n• Diurutkan worst-first (behind terbanyak, score rendah)\n• Lihat GMV vs target, avg score, action open, weekly status\n• Frozen vs Live per brand\n• Prioritas intervensi brand paling merah dulu',
      },
      {
        heading: 'Review Weekly / Monthly',
        content:
          'Di list Weekly/Monthly Report:\n• Tombol Review ✓ (status → reviewed)\n• Unreview jika perlu revisi BM\n• Hanya owner/admin\n\nReviewed = closing loop formal atasan, bukan ganti angka.',
      },
      {
        heading: 'Monitor KPI & Pace',
        content:
          '• Effective score untuk status (spend over budget tidak hijau)\n• Kolom Pace: Behind pace + butuh X/hari\n• Live vs Frozen banner\n• Hari Ini = log 1 hari (tidak freeze)\n• Trend 8 minggu: score efektif',
      },
      {
        heading: 'Pengaturan & Telegram',
        content:
          '• Brand, user, master KPI, target mingguan\n• Auto-sum formula: default Omzet (Total GMV)\n• Telegram: bot, chat, topic daily/weekly, jam report\n• Cron: GET /api/telegram/cron?secret=...\n• Jangan seed password demo di production',
      },
      {
        heading: 'Keputusan yang bagus dari sistem ini',
        content:
          '• Alokasi iklan: ROAS + pace GMV, bukan feeling\n• Fokus brand: Portfolio behind_count + open actions\n• Evaluasi BM: compliance sprint + % action closed + quality gate WR\n• Eskalasi: field eskalasi weekly + PIC Telegram',
      },
    ],
  },
  creative: {
    title: '🎨 Panduan Creative',
    color: '#A855F7',
    sections: [
      {
        heading: 'Daily Sprint',
        content:
          'Pagi: planning konten, deadline, hambatan, koordinasi brief dengan BM.\nSore: status konten (selesai / in_progress / pending / cancel), platform, catatan, win hari ini.',
      },
      {
        heading: 'Kaitan ke report',
        content:
          'Angka omzet/ROAS diisi BM/marketplace. Creative impact lewat consistency sprint + output yang disebut di Highlights weekly BM. Blocking (brief, revisi, asset) tulis jelas di sore.',
      },
    ],
  },
  public_relation: {
    title: '📢 Panduan Public Relation',
    color: '#EC4899',
    sections: [
      {
        heading: 'Daily log PR',
        content:
          'Sore: affiliator aktif posting, affiliator baru direkrut, follow-up, isu PR.\nIni sumber KPI Affiliator (sum/avg sesuai master KPI).',
      },
      {
        heading: 'Weekly',
        content:
          'Jika Affiliator Baru = 0 atau di bawah target, BM akan minta root cause + action (rekrut N orang, follow-up list X). Siapkan pipeline di action items.',
      },
    ],
  },
  admin_marketplace: {
    title: '🛒 Panduan Admin Marketplace',
    color: '#3B82F6',
    sections: [
      {
        heading: 'Daily log',
        content:
          'Order masuk/selesai/cancel, iklan spend, revenue iklan, ROAS harian, SKU terjual.\nAngka ini di-aggregate ke weekly (sum order/spend, avg ROAS).',
      },
      {
        heading: 'Pace & spend',
        content:
          'Spend adalah lower-is-better: over budget = status buruk meski % aktual tinggi.\nPantau Monitor mid-week — jangan kejar omzet dengan burn spend tanpa ROAS.',
      },
    ],
  },
  rnd: {
    title: '🔬 Panduan R&D',
    color: '#10B981',
    sections: [
      {
        heading: 'Daily log',
        content:
          'Pipeline produk, % progress, temuan testing, next step, eskalasi resource.\nSprint sore = jejak progress; BM/Owner baca di history untuk review bulanan.',
      },
    ],
  },
  reporting: {
    title: '📊 Playbook Optimasi Report',
    color: '#38BDF8',
    sections: [
      {
        heading: 'Hierarki data (jangan bolak-balik)',
        content:
          'Daily log (sprint sore)\n  → Live Monitor (agregasi shared engine)\n  → Weekly Report submit = FREEZE\n  → Monthly = rollup weekly submitted\n  → Portfolio Owner\n\nOverride aktual di Weekly boleh, tapi catat di notes. Setelah freeze, ubah lewat edit WR.',
      },
      {
        heading: 'Checklist kualitas Weekly',
        content:
          '☐ Load otomatis dijalankan\n☐ Angka selaras Monitor (sebelum freeze)\n☐ Action minggu lalu di-review\n☐ Behind KPI → root cause + action item\n☐ Max 3 action, ada PIC + due\n☐ Submit (bukan draft) sebelum meeting Owner\n☐ Senin: eksekusi action, bukan buka file baru',
      },
      {
        heading: 'Checklist Monthly',
        content:
          '☐ Semua weekly submitted (ideal 4/4)\n☐ Cek mode sum vs avg per KPI\n☐ Overall score masuk akal vs narasi\n☐ Rencana strategis = action yang measurable\n☐ Owner Review ✓',
      },
      {
        heading: 'Kesalahan umum (hindari)',
        content:
          '• Submit weekly kosong → ditolak sistem\n• Rayakan spend 200% sebagai "achieved" → sekarang merah\n• Sum ROAS 4 minggu → sudah avg\n• Double isi BM + owner omzet → dedupe per hari\n• Baca Monitor frozen sebagai live mid-week tanpa cek banner\n• Action plan free text tanpa PIC → pakai Action Items',
      },
      {
        heading: 'Ritme optimal 1 minggu',
        content:
          'Senin: Portfolio (Owner) + action open (BM)\nSel–Kam: daily log + cek Pace Rabu\nJumat: Weekly load → review → submit → freeze\nAkhir bulan: Monthly aggregate + review Owner',
      },
    ],
  },
};

export default function GuidePage() {
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUser(d.user);
      if (d.user?.role && GUIDES[d.user.role]) setActiveTab(d.user.role);
    });
  }, []);

  const tabs = [
    { key: 'all', label: 'Umum', color: 'var(--gold)' },
    { key: 'reporting', label: 'Playbook Report', color: '#38BDF8' },
    { key: 'brand_manager', label: 'Brand Manager', color: '#F59E0B' },
    { key: 'owner', label: 'Owner', color: '#94A3B8' },
    { key: 'creative', label: 'Creative', color: '#A855F7' },
    { key: 'public_relation', label: 'PR', color: '#EC4899' },
    { key: 'admin_marketplace', label: 'Marketplace', color: '#3B82F6' },
    { key: 'rnd', label: 'R&D', color: '#10B981' },
  ];

  const guide = GUIDES[activeTab] || GUIDES['all'];

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Panduan BrandOps</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Alur app + cara optimasi report · Role: {user?.role ? (ROLE_LABELS[user.role] || user.role) : '—'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${activeTab === tab.key ? tab.color : 'var(--border)'}`,
              background: activeTab === tab.key ? `${tab.color}22` : 'var(--bg-surface)',
              color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: guide.color, marginBottom: 20 }}>{guide.title}</h2>
        <div style={{ display: 'grid', gap: 20 }}>
          {guide.sections.map((section) => (
            <div key={section.heading}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{section.heading}</h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{section.content}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ borderColor: 'rgba(201,168,76,0.3)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>Ritme cepat</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { time: 'Pagi', icon: '🌅', label: 'Sprint Pagi', sub: 'Planning', color: '#F59E0B' },
            { time: 'Sore', icon: '🌆', label: 'Sprint Sore', sub: 'Daily log', color: '#3B82F6' },
            { time: 'Rabu', icon: '⚡', label: 'Cek Pace', sub: 'Monitor KPI', color: '#EF4444' },
            { time: 'Jumat', icon: '📊', label: 'Weekly WR', sub: 'Submit + freeze', color: '#10B981' },
            { time: 'Senin', icon: '🏢', label: 'Portfolio', sub: 'Owner prioritas', color: '#94A3B8' },
            { time: 'EOM', icon: '📅', label: 'Monthly', sub: 'Sum/avg weeks', color: '#A855F7' },
          ].map((item) => (
            <div key={item.label} style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>{item.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: item.color, marginTop: 4 }}>{item.time}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
