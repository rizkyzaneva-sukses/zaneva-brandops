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

  if (!data.brand_id || !data.month_year) {
    return NextResponse.json({ error: 'brand_id dan month_year wajib' }, { status: 400 });
  }

  if (session.user.role === 'brand_manager' && data.brand_id !== session.user.brand_id) {
    return NextResponse.json({ error: 'Hanya brand sendiri yang bisa disimpan' }, { status: 403 });
  }

  const status = data.status || 'draft';
  const scorecard = Array.isArray(data.scorecard) ? data.scorecard : [];
  if (status === 'submitted' && scorecard.length === 0) {
    return NextResponse.json({ error: 'Submit gagal: aggregate scorecard dulu sebelum submit' }, { status: 400 });
  }

  const report = await prisma.monthlyReport.upsert({
    where: { brand_id_month_year: { brand_id: data.brand_id, month_year: data.month_year } },
    update: {
      scorecard,
      keberhasilan: data.keberhasilan,
      kegagalan: data.kegagalan,
      insight_kompetitor: data.insight_kompetitor,
      rencana_strategis: data.rencana_strategis,
      status,
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
      ...(status === 'submitted' || status === 'draft' ? { reviewed_by: null, reviewed_at: null } : {}),
    },
    create: {
      brand_id: data.brand_id,
      brand_name: data.brand_name,
      month_label: data.month_label,
      month_year: data.month_year,
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
      scorecard,
      keberhasilan: data.keberhasilan,
      kegagalan: data.kegagalan,
      insight_kompetitor: data.insight_kompetitor,
      rencana_strategis: data.rencana_strategis,
      status,
    },
  });

  return NextResponse.json(report);
}

export async function PATCH(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await req.json();
  if (!data.id) return NextResponse.json({ error: 'id wajib' }, { status: 400 });

  const existing = await prisma.monthlyReport.findUnique({ where: { id: data.id } });
  if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  if (existing.status === 'draft') {
    return NextResponse.json({ error: 'Hanya report submitted yang bisa di-review' }, { status: 400 });
  }

  const nextStatus = data.status === 'submitted' ? 'submitted' : 'reviewed';
  const report = await prisma.monthlyReport.update({
    where: { id: data.id },
    data: nextStatus === 'reviewed'
      ? { status: 'reviewed', reviewed_by: session.user.full_name, reviewed_at: new Date() }
      : { status: 'submitted', reviewed_by: null, reviewed_at: null },
  });

  return NextResponse.json(report);
}
