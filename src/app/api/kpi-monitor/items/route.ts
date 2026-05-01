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
    let configs = await prisma.kpiBrandConfig.findMany({
      where: { brand_id, ...(enabled_only ? { is_enabled: true } : {}) },
      include: { kpi_item: true },
    });

    if (!enabled_only) {
      const allMasterKpis = await prisma.kpiItem.findMany({ where: { is_active: true } });
      const existingKpiIds = new Set(configs.map(c => c.kpi_item_id));
      const missingKpis = allMasterKpis.filter(k => !existingKpiIds.has(k.id));

      if (missingKpis.length > 0) {
        const brand = await prisma.brand.findUnique({ where: { id: brand_id } });
        if (brand) {
          await prisma.kpiBrandConfig.createMany({
            data: missingKpis.map(k => ({
              brand_id: brand.id,
              brand_name: brand.name,
              kpi_item_id: k.id,
              kpi_name: k.name,
              is_enabled: false,
            })),
          });
          
          configs = await prisma.kpiBrandConfig.findMany({
            where: { brand_id },
            include: { kpi_item: true },
          });
        }
      }
    }

    configs.sort((a, b) => a.kpi_item.order_num - b.kpi_item.order_num);

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

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, category, unit, description, auto_source_role } = await req.json();

  if (!name || !category || !unit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get current max order_num
  const lastKpi = await prisma.kpiItem.findFirst({
    orderBy: { order_num: 'desc' },
  });
  const order_num = (lastKpi?.order_num || 0) + 1;

  const id = crypto.randomUUID();

  const newKpi = await prisma.kpiItem.create({
    data: {
      id,
      name,
      category,
      unit,
      description,
      order_num,
      is_active: true,
      auto_aggregation: 'sum',
      auto_source_role: category === 'auto_daily_log' ? auto_source_role : null,
      auto_source: category === 'auto_daily_log' ? `custom_${id}` : null,
    },
  });

  return NextResponse.json(newKpi);
}

export async function PUT(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, name, category, unit, description, auto_source_role } = await req.json();

  if (!id || !name || !category || !unit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Update master KPI
  const updatedKpi = await prisma.kpiItem.update({
    where: { id },
    data: { 
      name, 
      category, 
      unit, 
      description,
      auto_source_role: category === 'auto_daily_log' ? auto_source_role : null,
      auto_source: category === 'auto_daily_log' ? `custom_${id}` : null,
    },
  });

  // Update denormalized kpi_name in all brand configs
  await prisma.kpiBrandConfig.updateMany({
    where: { kpi_item_id: id },
    data: { kpi_name: name },
  });

  return NextResponse.json(updatedKpi);
}
