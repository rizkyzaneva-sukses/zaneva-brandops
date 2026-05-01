import { startOfWeek, addDays, getISOWeek, format, differenceInDays, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';

// ─── DATE UTILS ───────────────────────────────────────────────────────────────

export function getCurrentWeek(date: Date = new Date()) {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  const sunday = addDays(monday, 6);
  const weekNum = getISOWeek(monday);
  const monthAbbr = format(monday, 'MMM yyyy', { locale: id });

  return {
    week_start: format(monday, 'yyyy-MM-dd'),
    week_end: format(sunday, 'yyyy-MM-dd'),
    week_start_date: monday,
    week_end_date: sunday,
    week_label: `W${weekNum} - ${monthAbbr}`,
    days_elapsed: differenceInDays(date, monday) + 1,
    total_days: 5,
  };
}

export function getWeekOptions(monthsBack = 2) {
  const weeks: { week_label: string; week_start: string; week_end: string }[] = [];
  const today = new Date();

  for (let i = 0; i < monthsBack * 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const w = getCurrentWeek(d);
    if (!weeks.find((x) => x.week_label === w.week_label)) {
      weeks.push({ week_label: w.week_label, week_start: w.week_start, week_end: w.week_end });
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

  return months;
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
    return (
      s.session === 'sore' &&
      s.user_role === kpiItem.auto_source_role &&
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
