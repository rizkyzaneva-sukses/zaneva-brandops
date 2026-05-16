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
  const week_label = searchParams.get('week_label');

  const where: Record<string, unknown> = {};
  if (['owner', 'admin'].includes(session.user.role)) {
    if (brand_id) where.brand_id = brand_id;
  } else {
    where.brand_id = session.user.brand_id;
  }
  if (week_label) where.week_label = week_label;

  const reports = await prisma.weeklyReport.findMany({
    where,
    orderBy: { week_start: 'desc' },
  });

  return NextResponse.json(reports);
}

export async function DELETE(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const report = await prisma.weeklyReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });

  // Brand manager can only delete their own brand's reports
  if (session.user.role === 'brand_manager' && report.brand_id !== session.user.brand_id) {
    return NextResponse.json({ error: 'Hanya laporan brand sendiri yang bisa dihapus' }, { status: 403 });
  }

  await prisma.weeklyReport.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const data = await req.json();

  const report = await prisma.weeklyReport.upsert({
    where: { brand_id_week_label: { brand_id: data.brand_id, week_label: data.week_label } },
    update: {
      kpis: data.kpis || [],
      highlights: data.highlights,
      lowlights: data.lowlights,
      root_cause: data.root_cause,
      action_plan: data.action_plan,
      eskalasi: data.eskalasi,
      status: data.status || 'draft',
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
    },
    create: {
      brand_id: data.brand_id,
      brand_name: data.brand_name,
      week_label: data.week_label,
      week_start: new Date(data.week_start + 'T00:00:00'),
      week_end: new Date(data.week_end + 'T23:59:59'),
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
      kpis: data.kpis || [],
      highlights: data.highlights,
      lowlights: data.lowlights,
      root_cause: data.root_cause,
      action_plan: data.action_plan,
      eskalasi: data.eskalasi,
      status: data.status || 'draft',
    },
  });

  return NextResponse.json(report);
}
