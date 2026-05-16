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
  const date = searchParams.get('date');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');
  const session_type = searchParams.get('session');
  const user_id = searchParams.get('user_id');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};

  // Brand isolation
  if (['owner', 'admin'].includes(session.user.role)) {
    if (brand_id) where.brand_id = brand_id;
  } else {
    where.brand_id = session.user.brand_id;
    if (brand_id && brand_id !== session.user.brand_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  if (date) where.standup_date = { gte: new Date(date + 'T00:00:00.000Z'), lte: new Date(date + 'T23:59:59.999Z') };
  if (date_from && date_to) {
    where.standup_date = { gte: new Date(date_from + 'T00:00:00.000Z'), lte: new Date(date_to + 'T23:59:59.999Z') };
  }
  if (session_type) where.session = session_type;
  if (user_id) where.user_id = user_id;
  if (status) where.status = status;

  const standups = await prisma.standup.findMany({
    where,
    orderBy: { standup_date: 'desc' },
    include: { user: { select: { full_name: true, email: true } } },
  });

  return NextResponse.json(standups);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();

  // Resolve brand_id: for owner/admin without brand_id, find or create a "Holding" brand
  let effectiveBrandId = session.user.brand_id || data.brand_id;
  let effectiveBrandName = session.user.brand_name || data.brand_name || 'Holding';

  if (!effectiveBrandId) {
    // Find or create a Holding brand for owner/admin users
    let holdingBrand = await prisma.brand.findFirst({ where: { name: 'Holding' } });
    if (!holdingBrand) {
      holdingBrand = await prisma.brand.create({
        data: { name: 'Holding', description: 'Holding company brand for owner/admin standups', status: 'active' },
      });
    }
    effectiveBrandId = holdingBrand.id;
    effectiveBrandName = holdingBrand.name;
  }

  // Normalize standup_date to UTC midnight to avoid timezone mismatches
  const standupDate = new Date(data.standup_date + 'T00:00:00.000Z');

  // Check if there's an existing submitted standup - only BM and Owner can edit submitted standups
  const existingStandup = await prisma.standup.findUnique({
    where: {
      brand_id_user_id_session_standup_date: {
        brand_id: effectiveBrandId,
        user_id: session.user.id,
        session: data.session,
        standup_date: standupDate,
      },
    },
  });

  // Any user can edit their own submitted standup (sprint milik sendiri)
  // Only owner/brand_manager can edit others' sprints (via PUT endpoint)

  try {
    const standup = await prisma.standup.upsert({
      where: {
        brand_id_user_id_session_standup_date: {
          brand_id: effectiveBrandId,
          user_id: session.user.id,
          session: data.session,
          standup_date: standupDate,
        },
      },
      update: {
        answers: data.answers || {},
        daily_log: data.daily_log || {},
        status: data.status || 'draft',
      },
      create: {
        brand_id: effectiveBrandId,
        brand_name: effectiveBrandName,
        user_id: session.user.id,
        user_name: session.user.full_name,
        user_role: session.user.role,
        session: data.session,
        standup_date: standupDate,
        answers: data.answers || {},
        daily_log: data.daily_log || {},
        status: data.status || 'draft',
      },
    });

    return NextResponse.json(standup);
  } catch (error: unknown) {
    console.error('[Standup POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Gagal menyimpan standup', detail: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owner and brand_manager can edit other people's sprints
  if (!['owner', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner dan Brand Manager yang dapat mengedit sprint tim lain' }, { status: 403 });
  }

  const data = await req.json();
  const { standup_id, answers, daily_log, status: newStatus } = data;

  if (!standup_id) {
    return NextResponse.json({ error: 'standup_id is required' }, { status: 400 });
  }

  // Find the standup
  const existing = await prisma.standup.findUnique({ where: { id: standup_id } });
  if (!existing) {
    return NextResponse.json({ error: 'Sprint tidak ditemukan' }, { status: 404 });
  }

  // Brand manager can only edit sprints within their own brand
  if (session.user.role === 'brand_manager' && existing.brand_id !== session.user.brand_id) {
    return NextResponse.json({ error: 'Brand Manager hanya dapat mengedit sprint dalam brand sendiri' }, { status: 403 });
  }

  const updated = await prisma.standup.update({
    where: { id: standup_id },
    data: {
      ...(answers !== undefined && { answers }),
      ...(daily_log !== undefined && { daily_log }),
      ...(newStatus !== undefined && { status: newStatus }),
    },
  });

  return NextResponse.json(updated);
}
