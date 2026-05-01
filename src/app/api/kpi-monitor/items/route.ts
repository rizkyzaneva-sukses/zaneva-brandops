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
  const enabled_only = searchParams.get('enabled_only') === 'true';

  if (brand_id) {
    // Return KPI brand configs for this brand
    const configs = await prisma.kpiBrandConfig.findMany({
      where: { brand_id, ...(enabled_only ? { is_enabled: true } : {}) },
      include: { kpi_item: true },
      orderBy: { kpi_item: { order_num: 'asc' } },
    });
    return NextResponse.json(configs);
  }

  // Return all master KPI items
  const items = await prisma.kpiItem.findMany({
    where: { is_active: true },
    orderBy: { order_num: 'asc' },
  });
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { brand_id, kpi_item_id, is_enabled } = await req.json();

  const config = await prisma.kpiBrandConfig.updateMany({
    where: { brand_id, kpi_item_id },
    data: { is_enabled },
  });

  return NextResponse.json(config);
}
