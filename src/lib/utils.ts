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

/** Business calendar date in Asia/Jakarta as YYYY-MM-DD */
export function getBusinessDateISO(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/** Local Date at noon for a YYYY-MM-DD business day (stable period math). */
export function parseBusinessDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function getBusinessNow(): Date {
  return parseBusinessDate(getBusinessDateISO());
}

export function getCurrentWeek(date: Date = getBusinessNow()) {
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

export function getWeekOptions(monthsBack = 6) {
  const weeks: { week_label: string; week_start: string; week_end: string }[] = [];
  const today = getBusinessNow();
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
  const today = getBusinessNow();

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

  const periods = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: lastDay },
  ];

  return periods.map((pd) => {
    const periodStart = new Date(year, month, pd.start);
    const weekNum = getWeekNumber(periodStart);
    const monthUpper = format(monthDate, 'MMM yyyy', { locale: id }).toUpperCase();
    return {
      week_label: `W${weekNum} [${pd.start} - ${pd.end} ${monthUpper}]`,
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
  // Business dates are stored as UTC midnight; prefer calendar day from ISO prefix / UTC
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.substring(0, 10);
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── NUMBER UTILS ─────────────────────────────────────────────────────────────

/** True when daily_log / input has a real numeric value (not blank). */
export function hasNumericValue(val: unknown): boolean {
  if (val === '' || val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val);
  const raw = String(val).trim();
  if (!raw) return false;
  return !isNaN(parseNum(raw));
}

export function parseNum(val: unknown): number {
  if (val === '' || val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const raw = String(val).trim().replace(/\s/g, '');
  if (!raw) return 0;
  // Plain JS number string (e.g. 7.4, 1109612) — keep as-is
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }
  // ID format: 1.000.000 or 7,4 or 1.000.000,5
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
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

/** Display number with ID thousand separators (1000000 → 1.000.000). Empty stays empty. */
export function formatIdInput(val: unknown): string {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseNum(val);
  if (isNaN(num)) return '';
  if (Math.abs(num - Math.round(num)) < 1e-9) {
    return Math.round(num).toLocaleString('id-ID');
  }
  return num.toLocaleString('id-ID', { maximumFractionDigits: 4 });
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
  const sourceKey = kpiItem.auto_source || '';
  const targetRole = kpiItem.auto_source_role || 'brand_manager';
  const filtered = standups.filter((s) => {
    const dateStr = toDateOnly(s.standup_date);
    // owner/admin can fill when target role is absent that day (deduped below)
    const roleMatch = s.user_role === targetRole || ['owner', 'admin'].includes(s.user_role);
    return (
      s.session === 'sore' &&
      roleMatch &&
      dateStr >= weekStart &&
      dateStr <= weekEnd &&
      s.status === 'submitted'
    );
  });

  // Per day: prefer target role; only use owner/admin if no target-role value that day.
  // Prevents BM + owner double-counting the same omzet day.
  type DayBucket = { target: number[]; other: number[] };
  const byDate = new Map<string, DayBucket>();
  for (const s of filtered) {
    const dateStr = toDateOnly(s.standup_date);
    const raw = (s.daily_log as Record<string, unknown>)?.[sourceKey];
    if (!hasNumericValue(raw)) continue;
    const val = parseNum(raw);
    let bucket = byDate.get(dateStr);
    if (!bucket) {
      bucket = { target: [], other: [] };
      byDate.set(dateStr, bucket);
    }
    if (s.user_role === targetRole) bucket.target.push(val);
    else bucket.other.push(val);
  }

  const values: number[] = [];
  for (const bucket of byDate.values()) {
    const src = bucket.target.length > 0 ? bucket.target : bucket.other;
    if (src.length === 0) continue;
    // Same role same day: sum (multiple users rare; avoids losing data)
    values.push(src.reduce((a, b) => a + b, 0));
  }

  if (values.length === 0) return null;

  if (kpiItem.auto_aggregation === 'sum') return values.reduce((a, b) => a + b, 0);
  if (kpiItem.auto_aggregation === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (kpiItem.auto_aggregation === 'count') return values.length;
  return null;
}

/** Monthly rollup: sum totals (GMV/spend/order); avg ratios (ROAS/rating/aktif). */
export function getMonthlyAggMode(unit: string, kpiName: string, autoAggregation?: string | null): 'sum' | 'avg' {
  if (autoAggregation === 'avg' || autoAggregation === 'sum') return autoAggregation;
  if (unit === 'percent') return 'avg';
  const name = (kpiName || '').toLowerCase();
  if (/roas|rating|score/.test(name)) return 'avg';
  if (/campaign\s*aktif|affiliator\s*aktif/.test(name)) return 'avg';
  if (unit === 'number' && /aktif/.test(name) && !/baru/.test(name)) return 'avg';
  return 'sum';
}

export function rollupMonthlyValues(values: number[], mode: 'sum' | 'avg'): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return mode === 'avg' ? sum / values.length : sum;
}

export type AutoSumFormula = 'omzet' | 'all_currency' | 'all_number' | 'by_role' | 'custom';

export interface AutoSumConfig {
  formula: AutoSumFormula;
  kpi_names: string;
  auto_source_role?: string | null;
}

/** Parse auto_sum config from kpi_item.platform JSON. Default: omzet (name /^om[sz]et/i). */
export function parseAutoSumConfig(platform: string | null | undefined, autoSourceRole?: string | null): AutoSumConfig {
  let formula: AutoSumFormula = 'omzet';
  let kpi_names = '';
  if (platform) {
    try {
      const parsed = JSON.parse(platform) as { formula?: string; kpi_names?: string };
      const f = (parsed.formula || '').trim();
      if (f === 'all_currency' || f === 'all_number' || f === 'by_role' || f === 'custom' || f === 'omzet') {
        formula = f;
      } else if (f) {
        formula = 'all_currency';
      }
      kpi_names = parsed.kpi_names || '';
    } catch {
      // platform may be a plain marketplace string (shopee/tiktok) — keep default omzet
    }
  }
  return { formula, kpi_names, auto_source_role: autoSourceRole };
}

export interface AutoSumSourceRow {
  kpi_item_id: string;
  kpi_name: string;
  unit: string;
  category: string;
  auto_source_role?: string | null;
}

/** Select which KPI rows feed an auto_sum KPI (single source of truth). */
export function selectAutoSumSources<T extends AutoSumSourceRow>(
  sources: T[],
  config: AutoSumConfig
): T[] {
  const daily = sources.filter((s) => s.category === 'auto_daily_log');
  const formula = config.formula || 'omzet';

  if (formula === 'all_currency') {
    return daily.filter((s) => s.unit === 'currency');
  }
  if (formula === 'all_number') {
    return daily.filter((s) => s.unit === 'number');
  }
  if (formula === 'by_role') {
    const role = config.auto_source_role || '';
    if (!role) return daily;
    return daily.filter((s) => (s.auto_source_role || '') === role);
  }
  if (formula === 'custom') {
    const names = (config.kpi_names || '')
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
    if (names.length === 0) return daily.filter((s) => s.unit === 'currency' && /^om[sz]et/i.test(s.kpi_name));
    return daily.filter((s) => names.includes(s.kpi_name.toLowerCase()));
  }
  // default + explicit "omzet": currency rows named Omzet/Omset*
  return daily.filter((s) => s.unit === 'currency' && /^om[sz]et/i.test(s.kpi_name));
}

/** Sum actual values for auto_sum from already-computed entry rows. */
export function sumAutoSumActuals(
  sources: { actual?: string | number | null }[]
): number {
  return sources.reduce((sum, row) => sum + parseNum(row.actual), 0);
}

export function calcRequiredDailyPace(target: number, currentActual: number, daysElapsed: number, totalDays: number): number {
  const remaining = target - currentActual;
  const daysLeft = totalDays - daysElapsed;
  if (daysLeft <= 0) return 0;
  return remaining / daysLeft;
}

/** Expected progress % by calendar pace (days elapsed / total days * 100). */
export function calcPaceExpectedPct(daysElapsed: number, totalDays: number): number {
  if (!totalDays || totalDays <= 0) return 0;
  const elapsed = Math.min(Math.max(daysElapsed, 0), totalDays);
  return Math.round((elapsed / totalDays) * 100);
}

/**
 * Pace status for mid-period early warning.
 * higherIsBetter=false: under target is good (spend).
 */
export function getPaceStatus(
  actual: number,
  target: number,
  daysElapsed: number,
  totalDays: number,
  higherIsBetter = true
): {
  expected_pct: number;
  actual_pct: number;
  required_daily: number;
  pace_status: 'ahead' | 'on_pace' | 'behind_pace' | 'done' | 'n_a';
  pace_label: string;
} {
  if (!target || target === 0) {
    return { expected_pct: 0, actual_pct: 0, required_daily: 0, pace_status: 'n_a', pace_label: '—' };
  }
  const expected_pct = calcPaceExpectedPct(daysElapsed, totalDays);
  const actual_pct = calcPct(actual, target);
  const required_daily = calcRequiredDailyPace(target, actual, daysElapsed, totalDays);

  if (higherIsBetter) {
    if (actual_pct >= 100) {
      return { expected_pct, actual_pct, required_daily: 0, pace_status: 'done', pace_label: 'Target tercapai' };
    }
    if (daysElapsed <= 0) {
      return { expected_pct, actual_pct, required_daily, pace_status: 'on_pace', pace_label: 'On pace' };
    }
    // Allow 10pp slack vs calendar pace
    if (actual_pct >= expected_pct - 10) {
      return { expected_pct, actual_pct, required_daily, pace_status: 'on_pace', pace_label: actual_pct >= expected_pct ? 'Ahead / on pace' : 'On pace' };
    }
    if (actual_pct >= expected_pct - 25) {
      return { expected_pct, actual_pct, required_daily, pace_status: 'behind_pace', pace_label: 'Behind pace' };
    }
    return { expected_pct, actual_pct, required_daily, pace_status: 'behind_pace', pace_label: 'Far behind pace' };
  }

  // Lower is better (spend): over target is bad regardless of pace mid-week
  if (actual <= target) {
    return { expected_pct, actual_pct, required_daily: 0, pace_status: 'on_pace', pace_label: 'Dalam budget' };
  }
  return { expected_pct, actual_pct, required_daily: 0, pace_status: 'behind_pace', pace_label: 'Over budget' };
}

export type ActionItemStatus = 'open' | 'done' | 'blocked';

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  due_date: string;
  status: ActionItemStatus;
  kpi_name?: string;
  notes?: string;
}

export function createActionItem(partial?: Partial<ActionItem>): ActionItem {
  return {
    id: partial?.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: partial?.title || '',
    owner: partial?.owner || '',
    due_date: partial?.due_date || '',
    status: partial?.status || 'open',
    kpi_name: partial?.kpi_name || '',
    notes: partial?.notes || '',
  };
}

export function normalizeActionItems(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const r = (item || {}) as Record<string, unknown>;
    const status = r.status === 'done' || r.status === 'blocked' ? r.status : 'open';
    return {
      id: String(r.id || `act_${i}`),
      title: String(r.title || ''),
      owner: String(r.owner || ''),
      due_date: String(r.due_date || ''),
      status,
      kpi_name: String(r.kpi_name || ''),
      notes: String(r.notes || ''),
    };
  });
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
