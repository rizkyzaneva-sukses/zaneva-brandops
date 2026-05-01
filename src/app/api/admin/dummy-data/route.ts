import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { getCurrentWeek } from '@/lib/utils';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  
  if (!session.user || session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Ambil semua brands & users
    const brands = await prisma.brand.findMany({ where: { status: 'active' } });
    if (brands.length === 0) return NextResponse.json({ error: 'No active brands found' }, { status: 400 });

    const kpiItems = await prisma.kpiItem.findMany({ where: { is_active: true } });

    // Dapatkan tanggal minggu ini dan minggu lalu
    const today = new Date();
    const currentWeek = getCurrentWeek();
    
    // Minggu lalu
    const lastWeekDate = new Date(today);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    
    const lastWeekLabel = `W${Math.ceil((lastWeekDate.getDate() + new Date(lastWeekDate.getFullYear(), lastWeekDate.getMonth(), 1).getDay()) / 7)} ${lastWeekDate.toLocaleString('default', { month: 'short' })} ${lastWeekDate.getFullYear()}`;

    // Loop setiap brand untuk generate data
    for (const brand of brands) {
      // 1. Buat Dummy KpiWeeklyTarget
      for (const kpi of kpiItems) {
        // Target minggu ini
        await prisma.kpiWeeklyTarget.upsert({
          where: { brand_id_week_label_kpi_item_id: { brand_id: brand.id, week_label: currentWeek.week_label, kpi_item_id: kpi.id } },
          update: {},
          create: {
            brand_id: brand.id,
            brand_name: brand.name,
            kpi_item_id: kpi.id,
            kpi_name: kpi.name,
            week_label: currentWeek.week_label,
            week_start_date: new Date(currentWeek.week_start),
            week_end_date: new Date(currentWeek.week_end),
            target_value: kpi.unit === 'currency' ? Math.floor(Math.random() * 10000000) + 1000000 : Math.floor(Math.random() * 1000) + 100
          }
        });

        // Target minggu lalu
        await prisma.kpiWeeklyTarget.upsert({
          where: { brand_id_week_label_kpi_item_id: { brand_id: brand.id, week_label: lastWeekLabel, kpi_item_id: kpi.id } },
          update: {},
          create: {
            brand_id: brand.id,
            brand_name: brand.name,
            kpi_item_id: kpi.id,
            kpi_name: kpi.name,
            week_label: lastWeekLabel,
            week_start_date: lastWeekDate,
            week_end_date: lastWeekDate,
            target_value: kpi.unit === 'currency' ? Math.floor(Math.random() * 10000000) + 1000000 : Math.floor(Math.random() * 1000) + 100
          }
        });

        // 2. Buat Dummy KpiDailySnapshot (3 hari terakhir)
        for (let i = 0; i < 3; i++) {
          const snapshotDate = new Date();
          snapshotDate.setDate(snapshotDate.getDate() - i);
          
          await prisma.kpiDailySnapshot.upsert({
            where: { brand_id_snapshot_date_kpi_item_id: { brand_id: brand.id, snapshot_date: snapshotDate, kpi_item_id: kpi.id } },
            update: {},
            create: {
              brand_id: brand.id,
              snapshot_date: snapshotDate,
              week_label: currentWeek.week_label,
              kpi_item_id: kpi.id,
              kpi_name: kpi.name,
              daily_value: kpi.unit === 'currency' ? Math.floor(Math.random() * 2000000) : Math.floor(Math.random() * 200),
              cumulative_value: kpi.unit === 'currency' ? Math.floor(Math.random() * 5000000) : Math.floor(Math.random() * 500),
              target_value: kpi.unit === 'currency' ? Math.floor(Math.random() * 10000000) + 1000000 : Math.floor(Math.random() * 1000) + 100,
              pct_of_target: Math.floor(Math.random() * 100)
            }
          });
        }
      }

      // 3. Buat Dummy Weekly Report (Minggu lalu)
      await prisma.weeklyReport.upsert({
        where: { brand_id_week_label: { brand_id: brand.id, week_label: lastWeekLabel } },
        update: {},
        create: {
          brand_id: brand.id,
          brand_name: brand.name,
          week_label: lastWeekLabel,
          week_start: lastWeekDate,
          week_end: lastWeekDate,
          submitted_by: 'Dummy Data',
          submitted_by_role: 'system',
          kpis: [],
          highlights: 'Penjualan meningkat berkat campaign TikTok, kolaborasi KOL sukses membawa traffic besar ke toko',
          lowlights: 'Ad spend membengkak karena CPC sedang mahal, ada kendala pengiriman di akhir pekan',
          root_cause: 'Kompetitor melakukan banting harga, algoritma TikTok agak berubah minggu ini',
          action_plan: 'Optimasi winning ads, kurangi budget untuk ads yang boncos, tambah kuota live streaming',
          eskalasi: 'Mohon persetujuan penambahan budget diskon Rp 5 juta untuk Flash Sale minggu depan',
          status: 'submitted'
        }
      });
      
      // 4. Buat Dummy Standups (Tim di brand ini)
      const brandUsers = await prisma.user.findMany({ where: { brand_id: brand.id, is_active: true } });
      for (const user of brandUsers) {
        for (let i = 0; i < 3; i++) {
          const sdDate = new Date();
          sdDate.setDate(sdDate.getDate() - i);
          const dateStr = sdDate.toISOString().split('T')[0];

          await prisma.standup.upsert({
            where: { brand_id_user_id_session_standup_date: { brand_id: brand.id, user_id: user.id, session: 'pagi', standup_date: sdDate } },
            update: {},
            create: {
              brand_id: brand.id,
              brand_name: brand.name,
              user_id: user.id,
              user_name: user.full_name,
              user_role: user.role,
              session: 'pagi',
              standup_date: sdDate,
              status: 'submitted',
              answers: { 
                target_utama: "Mencapai target harian hari ini, optimasi campaign, dan koordinasi tim",
                hambatan: "Semoga tidak ada halangan berarti hari ini, butuh review cepat dari BM"
              }
            }
          });

          await prisma.standup.upsert({
            where: { brand_id_user_id_session_standup_date: { brand_id: brand.id, user_id: user.id, session: 'sore', standup_date: sdDate } },
            update: {},
            create: {
              brand_id: brand.id,
              brand_name: brand.name,
              user_id: user.id,
              user_name: user.full_name,
              user_role: user.role,
              session: 'sore',
              standup_date: sdDate,
              status: 'submitted',
              answers: { 
                pencapaian: "Target selesai 80%, sisa akan dilanjut besok",
                kendala: "Approval asset konten sedikit telat",
                rencana_besok: "Fokus ke pembuatan script konten baru"
              },
              daily_log: {
                contoh_metrik: "123",
                contoh_metrik_catatan: "Selesai dikerjakan"
              }
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Dummy data generated successfully!' });
  } catch (error: any) {
    console.error('Failed to generate dummy data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
