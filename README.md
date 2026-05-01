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

## 👥 Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| owner@zaneva.id | owner123 | Owner |
| bm.zaneva@zaneva.id | bm123 | Brand Manager — Zaneva |
| creative.zaneva@zaneva.id | creative123 | Creative — Zaneva |
| pr.zaneva@zaneva.id | pr123 | Public Relation — Zaneva |
| marketplace.zaneva@zaneva.id | mp123 | Admin Marketplace — Zaneva |
| rnd.zaneva@zaneva.id | rnd123 | R&D — Zaneva |
| bm.besyari@zaneva.id | bm123 | Brand Manager — Be.Syari |

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
4. Build command: `npm install && npx prisma generate && npx prisma db push && node prisma/seed.js && npm run build`
5. Start command: `npm start`

## 📋 KPI Business Logic

- **Auto-aggregation**: KPI dari daily_log Sprint Sore diaggregate otomatis (sum/avg/count)
- **Priority**: Weekly Report yang sudah disubmit > real-time daily log aggregation
- **Total GMV**: auto_sum = Omzet Shopee + TikTok + Tokopedia
- **Post-submit feedback**: Setelah Sprint Sore disubmit, tampil progress KPI minggu ini

## 📄 License

Proprietary — ZANEVA Holding © 2026
