import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import {
  aggregateKpi,
  calcPct,
  calcEffectivePct,
  getCurrentWeek,
  getKpiStatus,
  normalizeActionItems,
  parseAutoSumConfig,
  parseNum,
  selectAutoSumSources,
} from '@/lib/utils';

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const week = getCurrentWeek();
  const brands = await prisma.brand.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });

  const brandCards = await Promise.all(brands.map(async (brand) => {
    const kpiConfigs = await prisma.kpiBrandConfig.findMany({
      where: { brand_id: brand.id, is_enabled: true, kpi_item: { is_active: true } },
      include: { kpi_item: true },
    });
    kpiConfigs.sort((a, b) => a.kpi_item.order_num - b.kpi_item.order_num);

    const targets = await prisma.kpiWeeklyTarget.findMany({
      where: { brand_id: brand.id, week_label: week.week_label },
    });

    const standups = await prisma.standup.findMany({
      where: {
        brand_id: brand.id,
        standup_date: {
          gte: new Date(week.week_start + 'T00:00:00.000Z'),
          lte: new Date(week.week_end + 'T23:59:59.999Z'),
        },
        session: 'sore',
        status: 'submitted',
      },
    });

    const weeklyReport = await prisma.weeklyReport.findFirst({
      where: { brand_id: brand.id, week_label: week.week_label, status: { in: ['submitted', 'reviewed'] } },
    });

    const standupRows = standups.map((s) => ({
      ...s,
      standup_date: s.standup_date.toISOString().split('T')[0],
      daily_log: s.daily_log as Record<string, unknown>,
    }));

    let gmvActual: number | null = null;
    let gmvTarget = 0;
    let behindCount = 0;
    let achievedCount = 0;
    let totalKpis = 0;
    let scoreSum = 0;

    for (const config of kpiConfigs) {
      const kpi = config.kpi_item;
      const target = targets.find((t) => t.kpi_item_id === kpi.id);
      const targetValue = target?.target_value || 0;
      let actualValue: number | null = null;

      if (weeklyReport) {
        const entry = ((weeklyReport.kpis as { kpi_item_id: string; actual: string }[]) || [])
          .find((k) => k.kpi_item_id === kpi.id);
        if (entry) actualValue = parseNum(entry.actual);
      }

      if (actualValue === null) {
        if (kpi.category === 'auto_sum') {
          const sumConfig = parseAutoSumConfig(kpi.platform, kpi.auto_source_role);
          const sources = selectAutoSumSources(
            kpiConfigs.filter((c) => c.is_enabled).map((c) => ({
              kpi_item_id: c.kpi_item_id,
              kpi_name: c.kpi_name,
              unit: c.kpi_item.unit,
              category: c.kpi_item.category,
              auto_source_role: c.kpi_item.auto_source_role,
              kpi_item: c.kpi_item,
            })),
            sumConfig
          );
          let total = 0;
          for (const sk of sources) {
            total += aggregateKpi(standupRows, sk.kpi_item, week.week_start, week.week_end) || 0;
          }
          actualValue = total;
        } else if (kpi.category === 'auto_daily_log') {
          actualValue = aggregateKpi(standupRows, kpi, week.week_start, week.week_end);
        }
      }

      if (targetValue > 0 || actualValue !== null) {
        totalKpis += 1;
        const higher = kpi.higher_is_better !== false;
        const score = calcEffectivePct(actualValue || 0, targetValue, higher);
        scoreSum += score;
        const st = getKpiStatus(score).status;
        if (st === 'behind' || st === 'at_risk') behindCount += 1;
        if (st === 'achieved') achievedCount += 1;
      }

      if (kpi.category === 'auto_sum' || /^total\s*gmv/i.test(kpi.name)) {
        gmvActual = actualValue;
        gmvTarget = targetValue;
      }
    }

    // Open actions from latest submitted/reviewed weekly (current or previous)
    const latestWeekly = await prisma.weeklyReport.findFirst({
      where: { brand_id: brand.id, status: { in: ['submitted', 'reviewed'] } },
      orderBy: { week_start: 'desc' },
    });
    const actions = normalizeActionItems(latestWeekly?.action_items);
    const openActions = actions.filter((a) => a.status === 'open' || a.status === 'blocked').length;

    // Sprint compliance today (sore)
    const todayUsers = await prisma.user.count({
      where: { brand_id: brand.id, is_active: true, role: { notIn: ['owner', 'admin'] } },
    });
    const todayStr = week.week_start; // not ideal for today; use business now via week helper separately
    // Use standups already filtered for week for rough activity
    const activeDays = new Set(standups.map((s) => s.standup_date.toISOString().split('T')[0])).size;

    return {
      brand_id: brand.id,
      brand_name: brand.name,
      week_label: week.week_label,
      gmv_actual: gmvActual,
      gmv_target: gmvTarget,
      gmv_pct: calcPct(gmvActual || 0, gmvTarget),
      avg_score: totalKpis > 0 ? Math.round(scoreSum / totalKpis) : 0,
      behind_count: behindCount,
      achieved_count: achievedCount,
      total_kpis: totalKpis,
      open_actions: openActions,
      has_weekly_report: !!weeklyReport,
      weekly_status: weeklyReport?.status || null,
      active_standup_days: activeDays,
      team_size: todayUsers,
      data_source: weeklyReport ? 'frozen_weekly' : 'live_standup',
    };
  }));

  // Sort worst first (behind + low score)
  brandCards.sort((a, b) => {
    if (b.behind_count !== a.behind_count) return b.behind_count - a.behind_count;
    return a.avg_score - b.avg_score;
  });

  return NextResponse.json({
    week_label: week.week_label,
    week_start: week.week_start,
    week_end: week.week_end,
    brands: brandCards,
  });
}
