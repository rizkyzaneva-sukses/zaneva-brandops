import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

// One-time cleanup: remove specific users by email list
export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user || session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Hanya Owner yang dapat melakukan aksi ini' }, { status: 403 });
  }

  const { emails } = await req.json();
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails array diperlukan' }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, full_name: true },
  });

  if (users.length === 0) {
    return NextResponse.json({ message: 'Tidak ada user ditemukan', deleted: 0 });
  }

  const userIds = users.map(u => u.id);

  const [standupCount, reportCount] = await Promise.all([
    prisma.standup.count({ where: { user_id: { in: userIds } } }),
    prisma.dailyReport.count({ where: { user_id: { in: userIds } } }),
  ]);

  await prisma.standup.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.dailyReport.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  return NextResponse.json({
    message: `${users.length} user berhasil dihapus`,
    deleted_users: users.map(u => u.full_name),
    deleted_standups: standupCount,
    deleted_reports: reportCount,
  });
}
