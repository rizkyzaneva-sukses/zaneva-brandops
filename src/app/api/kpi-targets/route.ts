import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import {
  ensureOmzetLainnyaFix,
  isOmzetLainnyaFixName,
  OMZET_LAINNYA_FIX_ID,
  OMZET_LAINNYA_FIX_NAME,
} from '@/lib/omzetLainnyaFix';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureOmzetLainnyaFix();

  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id');
  const week_label = searchParams.get('week_label');

  const where: Record<string, unknown> = {};
  if (brand_id) where.brand_id = brand_id;
  if (week_label) where.week_label = week_label;

  const targets = await prisma.kpiWeeklyTarget.findMany({
    where: { ...where, kpi_item: { is_active: true } },
    include: { kpi_item: true },
    orderBy: { kpi_item: { order_num: 'asc' } },
  });

  return NextResponse.json(targets);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureOmzetLainnyaFix();

  const { targets } = await req.json(); // Array of targets to save

  const normalizedTargets = new Map<string, { brand_id: string; brand_name: string; kpi_item_id: string; kpi_name: string; week_label: string; week_start_date: string; week_end_date: string; target_value: number }>();

  for (const target of targets as { brand_id: string; brand_name: string; kpi_item_id: string; kpi_name: string; week_label: string; week_start_date: string; week_end_date: string; target_value: number }[]) {
    const normalized = isOmzetLainnyaFixName(target.kpi_name)
      ? { ...target, kpi_item_id: OMZET_LAINNYA_FIX_ID, kpi_name: OMZET_LAINNYA_FIX_NAME }
      : target;
    const key = `${normalized.brand_id}::${normalized.week_label}::${normalized.kpi_item_id}`;
    normalizedTargets.set(key, normalized);
  }

  const results = await Promise.all(
    Array.from(normalizedTargets.values()).map((t) =>
      prisma.kpiWeeklyTarget.upsert({
        where: {
          brand_id_week_label_kpi_item_id: {
            brand_id: t.brand_id,
            week_label: t.week_label,
            kpi_item_id: t.kpi_item_id,
          },
        },
        update: { target_value: t.target_value },
        create: {
          brand_id: t.brand_id,
          brand_name: t.brand_name,
          kpi_item_id: t.kpi_item_id,
          kpi_name: t.kpi_name,
          week_label: t.week_label,
          week_start_date: new Date(t.week_start_date),
          week_end_date: new Date(t.week_end_date),
          target_value: t.target_value,
        },
      })
    )
  );

  return NextResponse.json(results);
}
