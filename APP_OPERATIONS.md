# ZANEVA BrandOps Operations Guide

Dokumen ini dipakai untuk operasional harian aplikasi, import data, dan deploy.

## Ringkasan

- App: `Next.js 15 + Prisma + PostgreSQL`
- Login session: `iron-session`
- Database utama: PostgreSQL dari `DATABASE_URL`
- Area admin utama: menu `Pengaturan`

## Owner Login

- Hanya akun yang `is_active = true` yang bisa login.
- Kredensial owner jangan ditulis di repo.
- Jika perlu ganti password owner, update hash password di tabel `User`.

## Import Data JSON

### Dari UI

1. Login sebagai owner.
2. Buka `Pengaturan`.
3. Masuk ke tab `Sistem (Owner)`.
4. Pilih file export `.json`.
5. Jalankan `Import Sekarang`.

### Dari terminal

```bash
npm run db:import -- "C:\path\to\zaneva_export.json"
```

### Perilaku import

- Brand lama akan dicocokkan ke brand app saat ini berdasarkan nama.
- KPI lama akan dinormalisasi ke key KPI app yang sekarang.
- User histori dari file import dibuat `nonaktif` untuk login.
- Data histori tetap dipertahankan untuk relasi standup dan report.
- Record invalid atau duplikat akan dilewati dan dilaporkan di ringkasan import.

## Reset Data

- Endpoint reset hanya menghapus data transaksi:
  - `Standup`
  - `DailyReport`
  - `WeeklyReport`
  - `MonthlyReport`
  - `KpiDailySnapshot`
  - `KpiWeeklyTarget`
- Master data seperti `Brand`, `User`, `KpiItem`, `KpiBrandConfig`, dan `StandupConfig` tetap aman.

## Deploy Checklist

1. Pastikan `DATABASE_URL` mengarah ke database target.
2. Set `SESSION_SECRET` dengan string acak yang panjang.
3. Jalankan:

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
```

4. Start app:

```bash
npm start
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/zaneva_brandops"
SESSION_SECRET="replace-with-a-long-random-secret"
SESSION_COOKIE_NAME="zaneva_session"
NEXTAUTH_URL="http://localhost:3000"
```

## Catatan Operasional

- Jangan commit password owner ke repo.
- Setelah import besar, cek halaman `Monitor KPI`, `History Sprint`, dan `Pengaturan`.
- Jika ingin membuka akses user selain owner, aktifkan `is_active` untuk user tersebut secara manual.
