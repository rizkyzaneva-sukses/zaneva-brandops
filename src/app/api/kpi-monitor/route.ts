import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import {
  aggregateKpi,
  calcPct,
  getKpiStatus,
  parseNum,
  calcEffectivePct,
  parseAutoSumConfig,
  selectAutoSumSources,
  getCurrentWeek,
  getPaceStatus,
  getBusinessDateISO,
} from '@/lib/utils';
import { ensureOmzetLainnyaFix } from '@/lib/omzetLainnyaFix';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let brand_id = searchParams.get('brand_id') || session.user.brand_id;
  const week_start = searchParams.get('week_start');
  const week_end = searchParams.get('week_end');
  const week_label = searchParams.get('week_label');
  // Optional single-day range (Hari Ini): still uses weekly target for context
  const day = searchParams.get('day');

  if (session.user.role === 'brand_manager') {
    brand_id = session.user.brand_id;
  }

  if (!brand_id || !week_start || !week_end || !week_label) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const rangeStart = day || week_start;
  const rangeEnd = day || week_end;

  await ensureOmzetLainnyaFix();

  // Get enabled KPIs for this brand
  const kpiConfigs = await prisma.kpiBrandConfig.findMany({
    where: { brand_id, is_enabled: true, kpi_item: { is_active: true } },
    include: { kpi_item: true },
  });
  kpiConfigs.sort((a, b) => a.kpi_item.order_num - b.kpi_item.order_num);

  // Get weekly targets
  const targets = await prisma.kpiWeeklyTarget.findMany({
    where: { brand_id, week_label },
  });

  // Get standups for range (week or single day)
  const standups = await prisma.standup.findMany({
    where: {
      brand_id,
      standup_date: { gte: new Date(rangeStart + 'T00:00:00.000Z'), lte: new Date(rangeEnd + 'T23:59:59.999Z') },
      session: 'sore',
      status: 'submitted',
    },
  });

  // Weekly freeze only applies to full-week view (not Hari Ini)
  const weeklyReport = !day
    ? await prisma.weeklyReport.findFirst({
        where: { brand_id, week_label, status: { in: ['submitted', 'reviewed'] } },
      })
    : null;

  // Build KPI data
  const kpiData = kpiConfigs.map((config) => {
    const kpi = config.kpi_item;
    const target = targets.find((t) => t.kpi_item_id === kpi.id);
    const targetValue = target?.target_value || 0;

    let actualValue: number | null = null;
    let isFromWeeklyReport = false;

    // Priority: Weekly Report (full week only) > Real-time aggregation
    if (weeklyReport) {
      const kpis = (weeklyReport.kpis as { kpi_item_id: string; actual: string }[]) || [];
      const entry = kpis.find((k) => k.kpi_item_id === kpi.id);
      if (entry) {
        actualValue = parseNum(entry.actual);
        isFromWeeklyReport = true;
      }
    }

    if (actualValue === null) {
      const standupRows = standups.map((s) => ({
        ...s,
        standup_date: s.standup_date.toISOString().split('T')[0],
        daily_log: s.daily_log as Record<string, unknown>,
      }));

      if (kpi.category === 'auto_sum') {
        const sumConfig = parseAutoSumConfig(kpi.platform, kpi.auto_source_role);
        const sourceConfigs = selectAutoSumSources(
          kpiConfigs
            .filter((c) => c.is_enabled)
            .map((c) => ({
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
        for (const sk of sourceConfigs) {
          const val = aggregateKpi(standupRows, sk.kpi_item, rangeStart, rangeEnd);
          total += val || 0;
        }
        actualValue = total;
      } else if (kpi.category === 'auto_daily_log') {
        actualValue = aggregateKpi(standupRows, kpi, rangeStart, rangeEnd);
      }
    }

    const pct = calcPct(actualValue || 0, targetValue);
    const higherIsBetter = kpi.higher_is_better !== false;
    const effectivePct = calcEffectivePct(actualValue || 0, targetValue, higherIsBetter);
    const statusInfo = getKpiStatus(effectivePct);

    // Pace vs calendar for current period only (full week view)
    const current = getCurrentWeek();
    const isCurrentPeriod = week_label === current.week_label && !day;
    const today = getBusinessDateISO();
    let daysElapsed = current.days_elapsed;
    let totalDays = current.total_days;
    if (isCurrentPeriod) {
      // recompute from selected week bounds if needed
      daysElapsed = current.days_elapsed;
      totalDays = current.total_days;
    } else if (!day) {
      // historical week: treat as fully elapsed
      daysElapsed = Math.max(1, Math.round((new Date(week_end + 'T12:00:00').getTime() - new Date(week_start + 'T12:00:00').getTime()) / 86400000) + 1);
      totalDays = daysElapsed;
      if (today < week_start) {
        daysElapsed = 0;
      } else if (today <= week_end) {
        daysElapsed = Math.round((new Date(today + 'T12:00:00').getTime() - new Date(week_start + 'T12:00:00').getTime()) / 86400000) + 1;
        totalDays = Math.round((new Date(week_end + 'T12:00:00').getTime() - new Date(week_start + 'T12:00:00').getTime()) / 86400000) + 1;
      }
    }

    const pace = day
      ? { expected_pct: 0, actual_pct: pct, required_daily: 0, pace_status: 'n_a' as const, pace_label: '—' }
      : getPaceStatus(actualValue || 0, targetValue, daysElapsed, totalDays, higherIsBetter);

    return {
      kpi_item_id: kpi.id,
      kpi_name: kpi.name,
      unit: kpi.unit,
      category: kpi.category,
      target_value: targetValue,
      actual_value: actualValue,
      pct,
      effective_pct: effectivePct,
      higher_is_better: higherIsBetter,
      status: statusInfo.status,
      status_label: statusInfo.label,
      is_from_weekly_report: isFromWeeklyReport,
      pace_status: pace.pace_status,
      pace_label: pace.pace_label,
      expected_pct: pace.expected_pct,
      required_daily: pace.required_daily,
      days_elapsed: daysElapsed,
      total_days: totalDays,
    };
  });

  return NextResponse.json({
    kpis: kpiData,
    has_weekly_report: !!weeklyReport,
    data_source: weeklyReport ? 'frozen_weekly' : 'live_standup',
    range: { start: rangeStart, end: rangeEnd, mode: day ? 'day' : 'week' },
  });
}
