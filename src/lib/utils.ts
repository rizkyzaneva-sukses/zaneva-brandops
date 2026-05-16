import { format, differenceInDays, parseISO, getDaysInMonth } from 'date-fns';
import { id } from 'date-fns/locale';

// ─── DATE UTILS ───────────────────────────────────────────────────────────────

// Period concept:
// Period 1: Day 1-7
// Period 2: Day 8-14
// Period 3: Day 15-21
// Period 4: Day 22-end of month (28/29/30/31)
// Week numbering starts from W1 = Jan 1-7, 2026

const EPOCH_YEAR = 2026;
const EPOCH_MONTH = 0; // January (0-indexed)

function getPeriodForDate(date: Date): { period: number; periodStart: Date; periodEnd: Date; monthDate: Date } {
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = getDaysInMonth(date);

  let period: number;
  let startDay: number;
  let endDay: number;

  if (day <= 7) {
    period = 1; startDay = 1; endDay = 7;
  } else if (day <= 14) {
    period = 2; startDay = 8; endDay = 14;
  } else if (day <= 21) {
    period = 3; startDay = 15; endDay = 21;
  } else {
    period = 4; startDay = 22; endDay = lastDay;
  }

  return {
    period,
    periodStart: new Date(year, month, startDay),
    periodEnd: new Date(year, month, endDay),
    monthDate: new Date(year, month, 1),
  };
}

function getWeekNumber(date: Date): number {
  // Calculate week number from epoch (Jan 1, 2026)
  // Each month has exactly 4 periods
  const year = date.getFullYear();
  const month = date.getMonth();
  const { period } = getPeriodForDate(date);

  // Months elapsed since epoch
  const monthsFromEpoch = (year - EPOCH_YEAR) * 12 + (month - EPOCH_MONTH);
  // Week number = monthsFromEpoch * 4 + period
  return monthsFromEpoch * 4 + period;
}

export function getCurrentWeek(date: Date = new Date()) {
  const { period, periodStart, periodEnd, monthDate } = getPeriodForDate(date);
  const weekNum = getWeekNumber(date);
  const monthUpper = format(monthDate, 'MMM yyyy', { locale: id }).toUpperCase();
  const startDay = periodStart.getDate();
  const endDay = periodEnd.getDate();
  const label = `W${weekNum} [${startDay} - ${endDay} ${monthUpper}]`;

  return {
    week_start: format(periodStart, 'yyyy-MM-dd'),
    week_end: format(periodEnd, 'yyyy-MM-dd'),
    week_start_date: periodStart,
    week_end_date: periodEnd,
    week_label: label,
    days_elapsed: differenceInDays(date, periodStart) + 1,
    total_days: differenceInDays(periodEnd, periodStart) + 1,
    period,
  };
}

export function getWeekOptions(monthsBack = 2) {
  const weeks: { week_label: string; week_start: string; week_end: string }[] = [];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Generate periods from current month going back
  for (let i = 0; i < monthsBack; i++) {
    const targetMonth = currentMonth - i;
    const y = currentYear + Math.floor(targetMonth / 12);
    const adjustedMonth = ((targetMonth % 12) + 12) % 12;
    const monthDate = new Date(y, adjustedMonth, 1);
    const lastDay = getDaysInMonth(monthDate);

    // 4 periods per month, in reverse order (newest first)
    const periods = [
      { p: 4, start: 22, end: lastDay },
      { p: 3, start: 15, end: 21 },
      { p: 2, start: 8, end: 14 },
      { p: 1, start: 1, end: 7 },
    ];

    for (const pd of periods) {
      const periodStart = new Date(y, adjustedMonth, pd.start);
      const periodEnd = new Date(y, adjustedMonth, pd.end);

      // Skip future periods
      if (periodStart > today) continue;

      const weekNum = getWeekNumber(periodStart);
      const monthUpper = format(monthDate, 'MMM yyyy', { locale: id }).toUpperCase();
      const label = `W${weekNum} [${pd.start} - ${pd.end} ${monthUpper}]`;

      if (!weeks.find(w => w.week_label === label)) {
        weeks.push({
          week_label: label,
          week_start: format(periodStart, 'yyyy-MM-dd'),
          week_end: format(periodEnd, 'yyyy-MM-dd'),
        });
      }
    }
  }

  return weeks;
}

export function getMonthOptions(monthsBack = 6) {
  const months: { month_label: string; month_year: string }[] = [];
  const today = new Date();

  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      month_label: format(d, 'MMMM yyyy', { locale: id }),
      month_year: format(d, 'yyyy-MM'),
    });
  }

  // Sort chronologically (oldest first = ascending)
  months.sort((a, b) => a.month_year.localeCompare(b.month_year));

  return months;
}

// Get all 4 period week_labels for a given month (for monthly aggregation)
export function getPeriodsForMonth(monthYear: string): { week_label: string; week_start: string; week_end: string }[] {
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed
  const monthDate = new Date(year, month, 1);
  const lastDay = getDaysInMonth(monthDate);
  const monthAbbr = format(monthDate, 'MMM yyyy', { locale: id });

  const periods = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: lastDay },
  ];

  return periods.map((pd) => {
    const periodStart = new Date(year, month, pd.start);
    const weekNum = getWeekNumber(periodStart);
    return {
      week_label: `W${weekNum} \u2013 ${monthAbbr}`,
      week_start: format(periodStart, 'yyyy-MM-dd'),
      week_end: format(new Date(year, month, pd.end), 'yyyy-MM-dd'),
    };
  });
}

export function formatDateID(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE, d MMMM yyyy', { locale: id });
}

export function formatDateShort(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yyyy', { locale: id });
}

export function toDateOnly(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── NUMBER UTILS ─────────────────────────────────────────────────────────────

export function parseNum(val: unknown): number {
  if (!val && val !== 0) return 0;
  const str = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function formatNum(val: unknown, unit: string): string {
  const num = parseNum(val);
  if (unit === 'currency') {
    return 'Rp ' + num.toLocaleString('id-ID');
  }
  if (unit === 'percent') {
    return num.toFixed(1) + '%';
  }
  return num.toLocaleString('id-ID');
}

export function formatCurrency(val: number): string {
  return 'Rp ' + val.toLocaleString('id-ID');
}

// ─── KPI UTILS ────────────────────────────────────────────────────────────────

export function calcPct(actual: number, target: number): number {
  if (!target || target === 0) return 0;
  return Math.round((actual / target) * 100);
}

// For KPIs where lower is better (e.g. spending), invert the percentage for status calculation
// For lower-is-better: actual <= target = good (100%), actual > target = progressively worse
export function calcEffectivePct(actual: number, target: number, higherIsBetter = true): number {
  if (!target || target === 0) return 0;
  if (higherIsBetter) return calcPct(actual, target);
  // Under/on budget → 100%; over budget → decreasing score
  // Formula: (2*target - actual) / target * 100, capped 0-100
  return Math.min(100, Math.max(0, Math.round(((2 * target - actual) / target) * 100)));
}

export type KpiStatus = 'achieved' | 'on_track' | 'at_risk' | 'behind';

export function getKpiStatus(pct: number): { label: string; status: KpiStatus; color: string } {
  if (pct >= 100) return { label: 'Achieved', status: 'achieved', color: 'emerald' };
  if (pct >= 70) return { label: 'On Track', status: 'on_track', color: 'green' };
  if (pct >= 50) return { label: 'At Risk', status: 'at_risk', color: 'amber' };
  return { label: 'Behind', status: 'behind', color: 'red' };
}

export function getKpiStatusClass(pct: number): string {
  if (pct >= 100) return 'status-achieved';
  if (pct >= 70) return 'status-on-track';
  if (pct >= 50) return 'status-at-risk';
  return 'status-behind';
}

export function getProgressColor(pct: number): string {
  if (pct >= 100) return '#10B981';
  if (pct >= 70) return '#22C55E';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

export function aggregateKpi(
  standups: { session: string; user_role: string; standup_date: string | Date; status: string; daily_log: Record<string, unknown> }[],
  kpiItem: { auto_source_role?: string | null; auto_source?: string | null; auto_aggregation: string },
  weekStart: string,
  weekEnd: string
): number | null {
  const filtered = standups.filter((s) => {
    const dateStr = toDateOnly(s.standup_date);
    const targetRole = kpiItem.auto_source_role || 'brand_manager';
    // owner/admin can fill in any KPI field — include them regardless of target role
    const roleMatch = s.user_role === targetRole || ['owner', 'admin'].includes(s.user_role);
    return (
      s.session === 'sore' &&
      roleMatch &&
      dateStr >= weekStart &&
      dateStr <= weekEnd &&
      s.status === 'submitted'
    );
  });

  const values = filtered
    .map((s) => parseNum((s.daily_log as Record<string, unknown>)?.[kpiItem.auto_source || '']))
    .filter((v) => !isNaN(v));

  if (values.length === 0) return null;

  if (kpiItem.auto_aggregation === 'sum') return values.reduce((a, b) => a + b, 0);
  if (kpiItem.auto_aggregation === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (kpiItem.auto_aggregation === 'count') return values.length;
  return null;
}

export function calcRequiredDailyPace(target: number, currentActual: number, daysElapsed: number, totalDays: number): number {
  const remaining = target - currentActual;
  const daysLeft = totalDays - daysElapsed;
  if (daysLeft <= 0) return 0;
  return remaining / daysLeft;
}

// ─── ROLE UTILS ───────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  brand_manager: 'Brand Manager',
  creative: 'Creative',
  public_relation: 'Public Relation',
  admin_marketplace: 'Admin Marketplace',
  rnd: 'R&D',
};

export const ROLE_CLASS: Record<string, string> = {
  creative: 'role-creative',
  public_relation: 'role-public_relation',
  admin_marketplace: 'role-admin_marketplace',
  rnd: 'role-rnd',
  brand_manager: 'role-brand_manager',
  owner: 'role-owner',
  admin: 'role-admin',
};

export const PRIVILEGED_ROLES = ['owner', 'admin'];
export const MANAGER_ROLES = ['owner', 'admin', 'brand_manager'];

export function canAccess(userRole: string, allowedRoles: string[]): boolean {
  if (allowedRoles.includes('all')) return true;
  return allowedRoles.includes(userRole);
}

// ─── MISC ─────────────────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
