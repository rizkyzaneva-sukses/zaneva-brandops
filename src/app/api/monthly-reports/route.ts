import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id');
  const month_year = searchParams.get('month_year');

  const where: Record<string, unknown> = {};
  if (['owner', 'admin'].includes(session.user.role)) {
    if (brand_id) where.brand_id = brand_id;
  } else {
    where.brand_id = session.user.brand_id;
  }
  if (month_year) where.month_year = month_year;

  const reports = await prisma.monthlyReport.findMany({ where, orderBy: { month_year: 'desc' } });
  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await req.json();

  const report = await prisma.monthlyReport.upsert({
    where: { brand_id_month_year: { brand_id: data.brand_id, month_year: data.month_year } },
    update: {
      scorecard: data.scorecard || [],
      keberhasilan: data.keberhasilan,
      kegagalan: data.kegagalan,
      insight_kompetitor: data.insight_kompetitor,
      rencana_strategis: data.rencana_strategis,
      status: data.status || 'draft',
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
    },
    create: {
      brand_id: data.brand_id,
      brand_name: data.brand_name,
      month_label: data.month_label,
      month_year: data.month_year,
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
      scorecard: data.scorecard || [],
      keberhasilan: data.keberhasilan,
      kegagalan: data.kegagalan,
      insight_kompetitor: data.insight_kompetitor,
      rencana_strategis: data.rencana_strategis,
      status: data.status || 'draft',
    },
  });

  return NextResponse.json(report);
}
