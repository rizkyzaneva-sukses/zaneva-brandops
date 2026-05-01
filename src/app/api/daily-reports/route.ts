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
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: Record<string, unknown> = {};

  if (['owner', 'admin'].includes(session.user.role)) {
    if (brand_id) where.brand_id = brand_id;
  } else {
    where.brand_id = session.user.brand_id;
  }

  if (category) where.category = category;
  if (status) where.status = status;

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: { report_date: 'desc' },
    take: limit,
  });

  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();

  const report = await prisma.dailyReport.create({
    data: {
      brand_id: session.user.brand_id || data.brand_id,
      brand_name: session.user.brand_name || data.brand_name || '',
      user_id: session.user.id,
      report_date: new Date(data.report_date + 'T00:00:00'),
      title: data.title,
      content: data.content,
      category: data.category || 'general',
      status: data.status || 'draft',
      submitted_by_name: session.user.full_name,
      submitted_by_role: session.user.role,
    },
  });

  return NextResponse.json(report);
}
