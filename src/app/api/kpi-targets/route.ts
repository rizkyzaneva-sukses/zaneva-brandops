import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id');
  const week_label = searchParams.get('week_label');

  const where: Record<string, unknown> = {};
  if (brand_id) where.brand_id = brand_id;
  if (week_label) where.week_label = week_label;

  const targets = await prisma.kpiWeeklyTarget.findMany({
    where,
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

  const { targets } = await req.json(); // Array of targets to save

  const results = await Promise.all(
    targets.map((t: { brand_id: string; brand_name: string; kpi_item_id: string; kpi_name: string; week_label: string; week_start_date: string; week_end_date: string; target_value: number }) =>
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
