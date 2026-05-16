import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { getCurrentWeek, formatDateID } from '@/lib/utils';

export default async function DashboardPage() {
  const user = await requireAuth();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const week = getCurrentWeek(today);

  // Today's standups for this user
  const myStandups = await prisma.standup.findMany({
    where: {
      user_id: user.id,
      standup_date: { gte: new Date(todayStr + 'T00:00:00'), lte: new Date(todayStr + 'T23:59:59') },
    },
  });

  const pagiSubmitted = myStandups.some(s => s.session === 'pagi' && s.status === 'submitted');
  const soreSubmitted = myStandups.some(s => s.session === 'sore' && s.status === 'submitted');

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const recentStandups = await prisma.standup.findMany({
    where: {
      brand_id: user.brand_id || undefined,
      standup_date: { gte: sevenDaysAgo },
      status: 'submitted',
    },
    orderBy: { standup_date: 'asc' },
  });

  // Daily counts for chart
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const count = recentStandups.filter(s => s.standup_date.toISOString().split('T')[0] === ds).length;
    dailyCounts.push({ date: ds, count });
  }

  // Standup status board (owner: all brands, others: own brand)
  let statusBoardData: { brand_name: string; brand_id: string; statuses: Record<string, { pagi: boolean; sore: boolean; name: string }> }[] = [];

  if (['owner', 'admin'].includes(user.role)) {
    const brands = await prisma.brand.findMany({ where: { status: 'active' } });
    const allUsers = await prisma.user.findMany({ where: { is_active: true } });
    const todayAllStandups = await prisma.standup.findMany({
      where: { standup_date: { gte: new Date(todayStr + 'T00:00:00'), lte: new Date(todayStr + 'T23:59:59') } },
    });

    statusBoardData = brands.map(brand => {
      const brandUsers = allUsers.filter(u => u.brand_id === brand.id);
      const statuses: Record<string, { pagi: boolean; sore: boolean; name: string }> = {};

      for (const bu of brandUsers) {
        const pagi = todayAllStandups.some(s => s.user_id === bu.id && s.session === 'pagi' && s.status === 'submitted');
        const sore = todayAllStandups.some(s => s.user_id === bu.id && s.session === 'sore' && s.status === 'submitted');
        statuses[bu.id] = { pagi, sore, name: bu.full_name };
      }

      return { brand_name: brand.name, brand_id: brand.id, statuses };
    });
  }

  // Recent reports
  const recentReports = await prisma.dailyReport.findMany({
    where: { brand_id: user.brand_id || undefined },
    orderBy: { report_date: 'desc' },
    take: 5,
  });

  return (
    <DashboardClient
      user={user}
      todayLabel={formatDateID(today)}
      pagiSubmitted={pagiSubmitted}
      soreSubmitted={soreSubmitted}
      dailyCounts={dailyCounts}
      statusBoardData={statusBoardData}
      recentReports={recentReports.map(r => ({ id: r.id, title: r.title, category: r.category, status: r.status, report_date: r.report_date.toISOString(), submitted_by_name: r.submitted_by_name, brand_name: r.brand_name }))}
      weekLabel={week.week_label}
      brandId={user.brand_id}
    />
  );
}
