import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

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
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await req.json();
    const email = String(data.email || '').trim().toLowerCase();
    const fullName = String(data.full_name || '').trim();
    const role = String(data.role || '').trim() as UserRole;
    const allowedRoles: UserRole[] = ['owner', 'admin', 'brand_manager', 'creative', 'public_relation', 'admin_marketplace', 'rnd'];

    if (!email || !fullName || !role) {
      return NextResponse.json({ error: 'Nama, email, dan role wajib diisi' }, { status: 400 });
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }

    if (role === 'owner' && session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Hanya owner yang boleh membuat akun owner' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(data.password || 'zaneva123', 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        full_name: fullName,
        role,
        brand_id: ['owner', 'admin'].includes(role) ? null : (data.brand_id || null),
        brand_name: ['owner', 'admin'].includes(role) ? null : (data.brand_name || null),
      },
      select: { id: true, email: true, full_name: true, role: true, brand_id: true, brand_name: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Gagal membuat user' }, { status: 500 });
  }
}
