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

  if (date) where.standup_date = { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59') };
  if (date_from && date_to) {
    where.standup_date = { gte: new Date(date_from + 'T00:00:00'), lte: new Date(date_to + 'T23:59:59') };
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

  // Check if there's an existing submitted standup - only BM and Owner can edit submitted standups
  const existingStandup = await prisma.standup.findUnique({
    where: {
      brand_id_user_id_session_standup_date: {
        brand_id: session.user.brand_id || data.brand_id,
        user_id: session.user.id,
        session: data.session,
        standup_date: new Date(data.standup_date + 'T00:00:00'),
      },
    },
  });

  if (existingStandup && existingStandup.status === 'submitted') {
    const canEdit = ['brand_manager', 'owner'].includes(session.user.role);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Hanya Brand Manager dan Owner yang dapat mengedit sprint yang sudah disubmit' },
        { status: 403 }
      );
    }
  }

  const standup = await prisma.standup.upsert({
    where: {
      brand_id_user_id_session_standup_date: {
        brand_id: session.user.brand_id || data.brand_id,
        user_id: session.user.id,
        session: data.session,
        standup_date: new Date(data.standup_date + 'T00:00:00'),
      },
    },
    update: {
      answers: data.answers || {},
      daily_log: data.daily_log || {},
      status: data.status || 'draft',
    },
    create: {
      brand_id: session.user.brand_id || data.brand_id,
      brand_name: session.user.brand_name || data.brand_name || '',
      user_id: session.user.id,
      user_name: session.user.full_name,
      user_role: session.user.role,
      session: data.session,
      standup_date: new Date(data.standup_date + 'T00:00:00'),
      answers: data.answers || {},
      daily_log: data.daily_log || {},
      status: data.status || 'draft',
    },
  });

  return NextResponse.json(standup);
}
