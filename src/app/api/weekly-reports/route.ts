import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import { calcEffectivePct, normalizeActionItems, parseNum } from '@/lib/utils';

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

  if (!data.brand_id || !data.week_label) {
    return NextResponse.json({ error: 'brand_id dan week_label wajib' }, { status: 400 });
  }

  if (session.user.role === 'brand_manager' && data.brand_id !== session.user.brand_id) {
    return NextResponse.json({ error: 'Hanya brand sendiri yang bisa disimpan' }, { status: 403 });
  }

  const status = data.status || 'draft';
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];
  const actionItems = normalizeActionItems(data.action_items);
  const actionItemsJson = actionItems as unknown as Prisma.InputJsonValue;

  if (status === 'submitted') {
    if (kpis.length === 0) {
      return NextResponse.json({ error: 'Submit gagal: load KPI dulu sebelum submit' }, { status: 400 });
    }
    if (!data.week_start || !data.week_end) {
      return NextResponse.json({ error: 'week_start dan week_end wajib' }, { status: 400 });
    }

    // Quality gate: any behind KPI (effective score < 70) requires root cause + action items
    const behind = kpis.filter((k: { actual?: string; target?: string; higher_is_better?: boolean; score?: number }) => {
      if (typeof k.score === 'number') return k.score < 70;
      const actual = parseNum(k.actual);
      const target = parseNum(k.target);
      if (!target) return false;
      const score = calcEffectivePct(actual, target, k.higher_is_better !== false);
      return score < 70;
    });

    if (behind.length > 0) {
      if (!String(data.root_cause || '').trim()) {
        return NextResponse.json({
          error: `Submit gagal: ada ${behind.length} KPI di bawah 70%. Isi Root Cause wajib.`,
        }, { status: 400 });
      }
      const validActions = actionItems.filter((a) => a.title.trim() && a.owner.trim());
      if (validActions.length === 0) {
        return NextResponse.json({
          error: 'Submit gagal: minimal 1 Action Item (judul + PIC) karena ada KPI behind.',
        }, { status: 400 });
      }
    }
  }

  const report = await prisma.weeklyReport.upsert({
    where: { brand_id_week_label: { brand_id: data.brand_id, week_label: data.week_label } },
    update: {
      kpis,
      highlights: data.highlights,
      lowlights: data.lowlights,
      root_cause: data.root_cause,
      action_plan: data.action_plan,
      eskalasi: data.eskalasi,
      action_items: actionItemsJson,
      status,
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
      ...(status === 'submitted' || status === 'draft' ? { reviewed_by: null, reviewed_at: null } : {}),
      ...(data.week_start ? { week_start: new Date(data.week_start + 'T00:00:00.000Z') } : {}),
      ...(data.week_end ? { week_end: new Date(data.week_end + 'T23:59:59.999Z') } : {}),
    },
    create: {
      brand_id: data.brand_id,
      brand_name: data.brand_name,
      week_label: data.week_label,
      week_start: new Date((data.week_start || '1970-01-01') + 'T00:00:00.000Z'),
      week_end: new Date((data.week_end || '1970-01-01') + 'T23:59:59.999Z'),
      submitted_by: session.user.full_name,
      submitted_by_role: session.user.role,
      kpis,
      highlights: data.highlights,
      lowlights: data.lowlights,
      root_cause: data.root_cause,
      action_plan: data.action_plan,
      eskalasi: data.eskalasi,
      action_items: actionItemsJson,
      status,
    },
  });

  return NextResponse.json(report);
}

/** Owner/admin mark weekly report as reviewed */
export async function PATCH(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await req.json();
  if (!data.id) return NextResponse.json({ error: 'id wajib' }, { status: 400 });

  const existing = await prisma.weeklyReport.findUnique({ where: { id: data.id } });
  if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  if (existing.status === 'draft') {
    return NextResponse.json({ error: 'Hanya report submitted yang bisa di-review' }, { status: 400 });
  }

  const nextStatus = data.status === 'submitted' ? 'submitted' : 'reviewed';
  const report = await prisma.weeklyReport.update({
    where: { id: data.id },
    data: nextStatus === 'reviewed'
      ? { status: 'reviewed', reviewed_by: session.user.full_name, reviewed_at: new Date() }
      : { status: 'submitted', reviewed_by: null, reviewed_at: null },
  });

  return NextResponse.json(report);
}
