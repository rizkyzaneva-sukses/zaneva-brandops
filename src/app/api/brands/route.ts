import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  // Non-owner users can only see their own brand
  if (!['owner', 'admin'].includes(session.user.role) && session.user.brand_id) {
    where.id = session.user.brand_id;
  }

  const brands = await prisma.brand.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(brands);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const data = await req.json();
  const brand = await prisma.brand.create({
    data: { name: data.name, description: data.description, logo_url: data.logo_url, status: data.status || 'active' },
  });

  return NextResponse.json(brand);
}
