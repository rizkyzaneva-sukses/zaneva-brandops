import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  
  if (!session.user || session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete all transactions (Keep Masters: User, Brand, KpiItem, KpiBrandConfig, StandupConfig)
    
    // Note: Use transaction to ensure data integrity
    await prisma.$transaction([
      prisma.standup.deleteMany({}),
      prisma.dailyReport.deleteMany({}),
      prisma.weeklyReport.deleteMany({}),
      prisma.monthlyReport.deleteMany({}),
      prisma.kpiDailySnapshot.deleteMany({}),
      prisma.kpiWeeklyTarget.deleteMany({})
    ]);

    return NextResponse.json({ success: true, message: 'All transaction data has been reset successfully!' });
  } catch (error: any) {
    console.error('Failed to reset data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
