import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id');

  const where: Record<string, unknown> = {};
  if (['owner', 'admin'].includes(session.user.role)) {
    if (brand_id) where.brand_id = brand_id;
  } else {
    where.brand_id = session.user.brand_id;
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, full_name: true, role: true, brand_id: true, brand_name: true, is_active: true, created_at: true },
    orderBy: { full_name: 'asc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await req.json();
  const hashed = await bcrypt.hash(data.password || 'zaneva123', 10);

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      password: hashed,
      full_name: data.full_name,
      role: data.role,
      brand_id: data.brand_id || null,
      brand_name: data.brand_name || null,
    },
    select: { id: true, email: true, full_name: true, role: true, brand_id: true, brand_name: true },
  });

  return NextResponse.json(user);
}
