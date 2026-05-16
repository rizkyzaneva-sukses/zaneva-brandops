import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import { aggregateKpi, calcPct, getKpiStatus, parseNum, calcEffectivePct } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'brand_manager'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const brand_id = searchParams.get('brand_id') || session.user.brand_id;
  const week_start = searchParams.get('week_start');
  const week_end = searchParams.get('week_end');
  const week_label = searchParams.get('week_label');

  if (!brand_id || !week_start || !week_end || !week_label) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // Get enabled KPIs for this brand
  const kpiConfigs = await prisma.kpiBrandConfig.findMany({
    where: { brand_id, is_enabled: true },
    include: { kpi_item: true },
  });

  // Get weekly targets
  const targets = await prisma.kpiWeeklyTarget.findMany({
    where: { brand_id, week_label },
  });

  // Get all standups for this week
  const standups = await prisma.standup.findMany({
    where: {
      brand_id,
      standup_date: { gte: new Date(week_start + 'T00:00:00'), lte: new Date(week_end + 'T23:59:59') },
      session: 'sore',
      status: 'submitted',
    },
  });

  // Check if weekly report exists (higher priority)
  const weeklyReport = await prisma.weeklyReport.findFirst({
    where: { brand_id, week_label, status: 'submitted' },
  });

  // Build KPI data
  const kpiData = kpiConfigs.map((config) => {
    const kpi = config.kpi_item;
    const target = targets.find((t) => t.kpi_item_id === kpi.id);
    const targetValue = target?.target_value || 0;

    let actualValue: number | null = null;
    let isFromWeeklyReport = false;

    // Priority: Weekly Report > Real-time aggregation
    if (weeklyReport) {
      const kpis = (weeklyReport.kpis as { kpi_item_id: string; actual: string }[]) || [];
      const entry = kpis.find((k) => k.kpi_item_id === kpi.id);
      if (entry) {
        actualValue = parseNum(entry.actual);
        isFromWeeklyReport = true;
      }
    }

    if (actualValue === null) {
      if (kpi.category === 'auto_sum') {
        // Sum all enabled auto_daily_log KPIs with currency unit whose name starts with "Omzet" or "Omset"
        const sumKpis = kpiConfigs.filter(
          (c) => c.kpi_item.category === 'auto_daily_log' && c.kpi_item.unit === 'currency' && c.is_enabled
            && /^om[sz]et/i.test(c.kpi_name)
        );
        let total = 0;
        for (const sk of sumKpis) {
          const val = aggregateKpi(
            standups.map((s) => ({ ...s, standup_date: s.standup_date.toISOString().split('T')[0], daily_log: s.daily_log as Record<string, unknown> })),
            sk.kpi_item,
            week_start,
            week_end
          );
          total += val || 0;
        }
        actualValue = total;
      } else if (kpi.category === 'auto_daily_log') {
        actualValue = aggregateKpi(
          standups.map((s) => ({ ...s, standup_date: s.standup_date.toISOString().split('T')[0], daily_log: s.daily_log as Record<string, unknown> })),
          kpi,
          week_start,
          week_end
        );
      }
    }

    const pct = calcPct(actualValue || 0, targetValue);
    const higherIsBetter = kpi.higher_is_better !== false;
    const effectivePct = calcEffectivePct(actualValue || 0, targetValue, higherIsBetter);
    const statusInfo = getKpiStatus(effectivePct);

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
    };
  });

  return NextResponse.json({ kpis: kpiData, has_weekly_report: !!weeklyReport });
}
