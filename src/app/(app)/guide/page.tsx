'use client';

import { useState, useEffect } from 'react';
import { ROLE_LABELS } from '@/lib/utils';

const GUIDES: Record<string, { title: string; color: string; sections: { heading: string; content: string }[] }> = {
  all: {
    title: '🚀 Panduan Umum BrandOps',
    color: 'var(--gold)',
    sections: [
      { heading: 'Apa itu ZANEVA BrandOps?', content: 'BrandOps adalah sistem manajemen operasional brand harian. Setiap anggota tim mengisi Daily Sprint 2x sehari (pagi & sore) untuk mendokumentasikan progress, hambatan, dan pencapaian.' },
      { heading: 'Alur Harian', content: '1. Pagi (sebelum mulai kerja): Isi Sprint Pagi — planning, hambatan, koordinasi\n2. Sore (akhir jam kerja): Isi Sprint Sore — review, pencapaian, daily log metrik\n3. Laporan Harian: Submit laporan khusus jika ada aktivitas penting\n4. Weekly Review: Brand Manager mengisi Weekly Report setiap Jumat\n5. Notifikasi Telegram: Sistem otomatis kirim ringkasan harian & weekly ke Telegram Group' },
      { heading: 'Tips Mengisi Sprint', content: '• Isi secara jujur dan spesifik\n• Gunakan angka aktual untuk daily log, bukan estimasi\n• Sebutkan blocking issue secara jelas agar bisa dieskalasi\n• Draft bisa disimpan dan dilengkapi nanti, tapi pastikan Submit sebelum jam kerja berakhir' },
      { heading: 'Notifikasi Telegram', content: 'Sistem akan otomatis mengirim notifikasi ke Telegram Group + Topic:\n• Report Sprint Pagi (jam 09:25 WIB): Daftar user yang belum submit Sprint Pagi\n• Report Sprint Sore (jam 18:00 WIB): Daftar user yang belum submit Sprint Sore\n• Jika ada yang belum sprint, Dwi Bintang Zaneva dan Kania Zaneva juga mendapat chat personal untuk follow up\n• Weekly KPI Report (Senin jam 10:30 WIB): Rekap performa KPI per brand dari periode berjalan\n\nDaily dan weekly bisa memakai group yang sama, tapi topic berbeda: Topic ID Daily untuk sprint harian, Topic ID Weekly untuk weekly report.\n\nKalau semua sudah sprint, pesan akan tampil: Alhamdulillah Done All ✅🎉\n\nPeriode: 1-7, 8-14, 15-21, 22-akhir bulan.\n\nNotifikasi dikirim otomatis, Anda tidak perlu melakukan apa-apa. Cukup pastikan sprint & daily log diisi tepat waktu.' },
      { heading: 'Format Periode Minggu', content: 'Setiap minggu ditampilkan dengan format: W18 [8 - 14 MEI 2026]\nArtinya: Minggu ke-18, periode tanggal 8 sampai 14 Mei 2026.\nPeriode dibagi 4 per bulan: 1-7, 8-14, 15-21, 22-akhir bulan.' },
    ],
  },
  creative: {
    title: '🎨 Panduan Creative',
    color: '#A855F7',
    sections: [
      { heading: 'Daily Log Creative', content: 'Di Sprint Sore, Anda mengisi daily log konten:\n• Judul/nama konten yang dikerjakan\n• Platform target (Instagram, TikTok, dll)\n• Status: selesai / in_progress / pending / cancel\n• Catatan singkat' },
      { heading: 'Sprint Pagi — Fokus', content: 'Isi planning konten harian, deadline yang mendekat, dan hambatan yang mungkin muncul. Koordinasikan dengan BM jika ada revisi brief.' },
      { heading: 'Sprint Sore — Review', content: 'Review pencapaian: konten apa yang selesai, apa yang masih pending & kenapa, feedback yang diterima, dan win terbesar hari ini.' },
    ],
  },
  public_relation: {
    title: '📢 Panduan Public Relation',
    color: '#EC4899',
    sections: [
      { heading: 'Daily Log PR / Affiliator', content: 'Di Sprint Sore, isi daily log:\n• Affiliator aktif posting hari ini (jumlah)\n• Affiliator baru direkrut (jumlah)\n• Follow-up yang dilakukan\n• Isu PR yang muncul' },
      { heading: 'Sprint Pagi', content: 'Rencanakan campaign aktif, target reach/engagement, dan daftar affiliator yang perlu di-follow up hari ini.' },
      { heading: 'Sprint Sore', content: 'Laporkan hasil campaign, respons affiliator, dan isu PR yang terjadi. Tentukan follow-up untuk besok.' },
    ],
  },
  admin_marketplace: {
    title: '🛒 Panduan Admin Marketplace',
    color: '#3B82F6',
    sections: [
      { heading: 'Daily Log Marketplace', content: 'Di Sprint Sore, isi daily log:\n• Total order masuk\n• Order selesai / terproses\n• Order cancel / retur\n• Iklan spend (Rp)\n• Revenue dari iklan (Rp)\n• ROAS harian\n• Produk terjual (SKU)' },
      { heading: 'Sprint Pagi', content: 'Tentukan target order, cek status iklan yang berjalan, catat promo/voucher aktif, dan identifikasi produk stok kritis.' },
      { heading: 'Sprint Sore', content: 'Review performa iklan hari ini, laporkan isu operasional (retur, komplain), dan rencanakan action untuk besok.' },
    ],
  },
  rnd: {
    title: '🔬 Panduan R&D',
    color: '#10B981',
    sections: [
      { heading: 'Daily Log R&D', content: 'Di Sprint Sore, isi daily log pipeline:\n• Produk / pipeline yang sedang dikerjakan\n• Status progress (dalam persentase)\n• Temuan testing\n• Catatan penting' },
      { heading: 'Sprint Pagi', content: 'Review pipeline aktif, tentukan task hari ini, dan identifikasi resource atau support yang dibutuhkan dari tim lain.' },
      { heading: 'Sprint Sore', content: 'Laporkan progress pipeline, temuan riset/testing, update status, next step, dan eskalasi ke atasan jika diperlukan.' },
    ],
  },
  brand_manager: {
    title: '🎯 Panduan Brand Manager',
    color: '#F59E0B',
    sections: [
      { heading: 'Tanggung Jawab BM', content: '• Monitor KPI brand secara real-time\n• Submit Daily Log metrik utama (Omzet, ROAS, Campaign)\n• Isi Weekly Report setiap Jumat\n• Review laporan harian tim\n• Koordinasi antara divisi\n• Pantau Trend KPI mingguan di tab Trend (Monitor KPI)' },
      { heading: 'Daily Log BM', content: 'Isi di Sprint Sore:\n• Omzet Shopee / TikTok / Tokopedia aktual hari ini\n• ROAS iklan\n• Rating toko rata-rata\n• Jumlah campaign aktif' },
      { heading: 'Weekly Report', content: 'Setiap akhir minggu:\n1. Buka menu Weekly Report\n2. Pilih brand & minggu\n3. Load data otomatis dari daily log\n4. Cek dan sesuaikan angka KPI\n5. Isi narasi: Highlights, Lowlights, Root Cause, Action Plan\n6. Submit' },
      { heading: 'Trend KPI (Tab Trend)', content: 'Di halaman Monitor KPI, klik tab "📈 Trend" untuk melihat:\n• Grafik line chart pergerakan KPI 8 minggu terakhir\n• Tabel summary dengan indikator naik (↑) / turun (↓) / stabil (→)\n• Gunakan ini untuk identifikasi pola dan early warning jika KPI menurun' },
      { heading: 'Kehadiran Tim (Tab Kehadiran)', content: 'Di halaman History Sprint, klik tab "📅 Kehadiran" untuk melihat:\n• Grid kehadiran per anggota tim (🌅 = pagi, 🌆 = sore, ⬜ = tidak isi)\n• Persentase kehadiran dan ranking\n• Gunakan data ini untuk follow-up anggota yang sering skip standup' },
    ],
  },
  owner: {
    title: '👑 Panduan Owner',
    color: '#94A3B8',
    sections: [
      { heading: 'Dashboard Owner', content: 'Anda bisa melihat:\n• Status board sprint harian semua brand\n• Progress KPI semua brand\n• Aktivitas chart 7 hari terakhir\n• Laporan harian terbaru' },
      { heading: 'Monitor KPI', content: 'Di menu Monitor KPI, pilih brand untuk melihat progress KPI minggu ini. Data diambil real-time dari daily log atau dari Weekly Report yang sudah disubmit (prioritas lebih tinggi).' },
      { heading: 'Trend KPI (Tab Trend)', content: 'Di halaman Monitor KPI, klik tab "📈 Trend" untuk melihat:\n• Grafik line chart pergerakan semua KPI selama 8 minggu terakhir\n• Tabel summary per KPI dengan indikator tren (↑ naik / ↓ turun / → stabil)\n• Bandingkan performa antar minggu untuk identifikasi pola\n• Deteksi early warning jika ada KPI yang konsisten menurun' },
      { heading: 'Kehadiran Tim (Tab Kehadiran)', content: 'Di halaman History Sprint, klik tab "📅 Kehadiran" untuk melihat:\n• Grid kehadiran seluruh tim (🌅 = sprint pagi, 🌆 = sprint sore, ⬜ = tidak isi)\n• Summary card: total hari, rata-rata kehadiran, anggota paling rajin\n• Ranking kehadiran dari tertinggi ke terendah\n• Filter per brand dan rentang tanggal\n• Gunakan untuk evaluasi kedisiplinan tim' },
      { heading: 'Pengaturan', content: 'Anda bisa:\n• Tambah/edit brand\n• Manage user dan role\n• Tambah Master KPI baru (jika ada metric unik)\n• Set KPI yang aktif per brand\n• Set target KPI mingguan\n• Setup Telegram notifikasi (tab Telegram)' },
      { heading: 'Setup Telegram (Tab Telegram di Pengaturan)', content: 'Untuk mengaktifkan notifikasi otomatis ke Telegram:\n1. Buka Pengaturan → Tab "Telegram"\n2. Klik "Tambah Destinasi"\n3. Isi: Nama, Bot Token, Chat ID, Topic ID Daily, Topic ID Weekly, Telegram ID Dwi, dan Telegram ID Kania\n4. Jadwal sprint harian otomatis: 09:25 untuk pagi dan 18:00 untuk sore; weekly default Senin 10:30\n5. Klik "Test" untuk verifikasi koneksi\n6. Aktifkan destinasi\n\nAnda bisa menambah beberapa destinasi (multi-group). Untuk group yang sama dengan topic berbeda, pakai Chat ID yang sama lalu isi Topic ID Daily dan Topic ID Weekly sesuai topic Telegram.\n\nCara mendapatkan Bot Token:\n• Chat @BotFather di Telegram → /newbot → ikuti instruksi\n\nCara mendapatkan Chat ID & Topic ID:\n• Tambahkan bot ke group → kirim pesan → cek via API getUpdates\n• Topic ID terlihat di URL saat membuka topic di Telegram Desktop' },
      { heading: 'Trigger Manual & Cron', content: 'Di tab Telegram (Pengaturan), tersedia tombol:\n• "Kirim Sprint Pagi" — trigger manual daftar user yang belum Sprint Pagi\n• "Kirim Sprint Sore" — trigger manual daftar user yang belum Sprint Sore\n• "Kirim Weekly Report" — trigger manual laporan mingguan (periode saat ini)\n\nJadwal otomatis:\n• Report Sprint Pagi: setiap hari jam 09:25 WIB\n• Report Sprint Sore: setiap hari jam 18:00 WIB\n• Weekly KPI Report: setiap Senin jam 10:30 WIB\n\nUntuk otomatis, setup cron job di Easypanel yang memanggil:\nGET /api/telegram/cron?secret=YOUR_CRON_SECRET\nSetiap menit atau setiap 5 menit. Sistem akan cek jadwal & tanggal, lalu kirim otomatis.' },
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
    { key: 'creative', label: 'Creative', color: '#A855F7' },
    { key: 'public_relation', label: 'PR', color: '#EC4899' },
    { key: 'admin_marketplace', label: 'Marketplace', color: '#3B82F6' },
    { key: 'rnd', label: 'R&D', color: '#10B981' },
    { key: 'brand_manager', label: 'Brand Manager', color: '#F59E0B' },
    { key: 'owner', label: 'Owner', color: '#94A3B8' },
  ];

  const guide = GUIDES[activeTab] || GUIDES['all'];

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Panduan BrandOps</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cara menggunakan sistem sesuai role Anda</p>
      </div>

      {/* Role Tabs */}
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
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Guide Content */}
      <div className="card" style={{ border: `1px solid ${guide.color}33` }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: guide.color, marginBottom: 20 }}>{guide.title}</h2>
        <div style={{ display: 'grid', gap: 20 }}>
          {guide.sections.map(section => (
            <div key={section.heading}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>{section.heading}</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-line', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 8, borderLeft: `3px solid ${guide.color}` }}>
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Visual */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Alur Kerja Harian</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
          {[
            { time: 'Pagi', icon: '☀️', label: 'Sprint Pagi', sub: 'Planning hari ini', color: '#F59E0B' },
            { time: '→', icon: '', label: '', sub: '', color: 'var(--border)' },
            { time: 'Siang', icon: '⚡', label: 'Eksekusi', sub: 'Kerjakan task', color: '#3B82F6' },
            { time: '→', icon: '', label: '', sub: '', color: 'var(--border)' },
            { time: 'Sore', icon: '🌆', label: 'Sprint Sore', sub: 'Review + log metrik', color: '#A855F7' },
            { time: '→', icon: '', label: '', sub: '', color: 'var(--border)' },
            { time: 'Jumat', icon: '📊', label: 'Weekly Report', sub: 'BM submit summary', color: '#10B981' },
          ].map((step, i) => (
            step.label ? (
              <div key={i} style={{ textAlign: 'center', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: `1px solid ${step.color}44`, minWidth: 120, flexShrink: 0 }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{step.icon}</div>
                <div style={{ fontSize: 10, color: step.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{step.time}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{step.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{step.sub}</div>
              </div>
            ) : (
              <div key={i} style={{ color: 'var(--text-muted)', fontSize: 18, padding: '0 4px', flexShrink: 0 }}>→</div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
