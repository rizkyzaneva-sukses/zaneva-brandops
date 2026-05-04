# ZANEVA BrandOps

Brand Operations Management System untuk ZANEVA Holding.

## 🚀 Fitur

- **Daily Sprint** — Check-in pagi & sore per role (Creative, PR, Marketplace, R&D, Brand Manager)
- **Daily Log** — Input metrik harian otomatis (Omzet, ROAS, Order, Affiliator, dll)
- **Laporan Harian** — Dokumentasi aktivitas per divisi
- **Weekly Report** — Auto-aggregate KPI dari daily log + narasi analisis
- **Monthly Report** — Scorecard bulanan dari weekly reports
- **KPI Monitor** — Real-time progress KPI vs target
- **Target KPI** — Set target mingguan per brand
- **History Sprint** — Riwayat sprint dengan filter
- **Laporan Kinerja** — Compliance sprint per anggota tim
- **Panduan** — Dokumentasi cara penggunaan per role
- **Pengaturan** — Manajemen brand, user, dan konfigurasi KPI

## 🛠 Tech Stack

- **Frontend + Backend**: Next.js 15 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: iron-session
- **UI**: Tailwind CSS + Recharts
- **Language**: TypeScript

## 📦 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Setup environment
```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/zaneva_brandops"
SESSION_SECRET="ganti-dengan-string-acak-minimal-32-karakter-xxxxxxxx"
SESSION_COOKIE_NAME="zaneva_session"
```

### 3. Setup database
```bash
# Push schema ke database
npx prisma db push

# Seed data awal (brands, users, KPI)
node prisma/seed.js
```

### 4. Jalankan
```bash
npm run dev
```

Buka http://localhost:3000

### Setup otomatis (semua langkah sekaligus)
```bash
npm run setup
```

## 👤 Login App

- App sekarang disiapkan untuk penggunaan nyata, bukan demo publik.
- Kredensial owner dan password dikelola manual di database, jangan disimpan di repo.
- User histori hasil import bisa disimpan untuk relasi data, tetapi sebaiknya tetap nonaktif untuk login kecuali memang ingin dibuka aksesnya.

## 🏗 Struktur Project

```
zaneva-brandops/
├── prisma/
│   ├── schema.prisma       # Database schema (20 model)
│   └── seed.js             # Seed data awal
├── src/
│   ├── app/
│   │   ├── api/            # API routes (REST)
│   │   │   ├── auth/       # Login, logout, me
│   │   │   ├── brands/     # CRUD brands
│   │   │   ├── standups/   # Daily Sprint
│   │   │   ├── daily-reports/
│   │   │   ├── weekly-reports/
│   │   │   ├── monthly-reports/
│   │   │   ├── kpi-targets/
│   │   │   ├── kpi-monitor/
│   │   │   └── users/
│   │   ├── (auth)/login/   # Login page
│   │   └── (app)/          # Protected pages
│   │       ├── dashboard/
│   │       ├── standup/
│   │       ├── reports/
│   │       ├── weekly-report/
│   │       ├── monthly-report/
│   │       ├── kpi-target/
│   │       ├── kpi-monitor/
│   │       ├── standup-history/
│   │       ├── individual-report/
│   │       ├── guide/
│   │       └── pengaturan/
│   ├── components/
│   │   ├── layout/AppShell.tsx
│   │   └── dashboard/DashboardClient.tsx
│   └── lib/
│       ├── auth.ts         # Server-side auth helpers
│       ├── session.ts      # iron-session config
│       ├── prisma.ts       # Prisma singleton
│       ├── utils.ts        # KPI logic, date, number helpers
│       └── standupConfig.ts # Sprint questions per role
```

## 🔑 Deployment (EasyPanel)

1. Push ke GitHub
2. Create new app di EasyPanel → Connect repo
3. Set environment variables (DATABASE_URL, SESSION_SECRET, SESSION_COOKIE_NAME)
4. Build command: `npm install && npx prisma generate && npx prisma db push && npm run build`
5. Start command: `npm start`

## 📥 Import Data

- Import JSON histori bisa dijalankan via terminal:
```bash
npm run db:import -- "C:\path\to\zaneva_export.json"
```
- Owner juga bisa import langsung dari menu `Pengaturan` → `Sistem (Owner)` → `Import Data JSON`
- Import akan menormalkan brand, user histori, standup config, KPI item, KPI brand config, dan KPI weekly target
- Default perilaku import sekarang: user hasil import dibuat nonaktif untuk login

## 📚 Dokumentasi Tambahan

- Lihat [APP_OPERATIONS.md](D:/APP/zaneva-brandops/zaneva-brandops/APP_OPERATIONS.md) untuk panduan operasional, import, login owner, dan checklist deploy

## 📋 KPI Business Logic

- **Auto-aggregation**: KPI dari daily_log Sprint Sore diaggregate otomatis (sum/avg/count)
- **Priority**: Weekly Report yang sudah disubmit > real-time daily log aggregation
- **Total GMV**: auto_sum = Omzet Shopee + TikTok + Tokopedia
- **Post-submit feedback**: Setelah Sprint Sore disubmit, tampil progress KPI minggu ini

## 📄 License

Proprietary — ZANEVA Holding © 2026
