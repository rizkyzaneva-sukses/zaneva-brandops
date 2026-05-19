export type DailySprintSession = 'pagi' | 'sore';

export type DailySchedule = Record<DailySprintSession, string>;

export const DEFAULT_DAILY_SCHEDULE: DailySchedule = {
  pagi: '09:25',
  sore: '18:00',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MATCH_PATTERN = /\b(?:[01]\d|2[0-3]):[0-5]\d\b/g;

function normalizeTime(value: unknown, fallback: string) {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : fallback;
}

export function parseDailySchedule(value?: string | null): DailySchedule {
  const raw = (value || '').trim();
  if (!raw) return { ...DEFAULT_DAILY_SCHEDULE };

  try {
    const parsed = JSON.parse(raw) as Partial<DailySchedule>;
    if (parsed && typeof parsed === 'object') {
      return {
        pagi: normalizeTime(parsed.pagi, DEFAULT_DAILY_SCHEDULE.pagi),
        sore: normalizeTime(parsed.sore, DEFAULT_DAILY_SCHEDULE.sore),
      };
    }
  } catch {
    // Older values are plain strings, not JSON.
  }

  const times = raw.match(TIME_MATCH_PATTERN) || [];
  if (times.length >= 2) {
    return { pagi: times[0]!, sore: times[1]! };
  }

  if (times.length === 1) {
    return { pagi: times[0]!, sore: DEFAULT_DAILY_SCHEDULE.sore };
  }

  return { ...DEFAULT_DAILY_SCHEDULE };
}

export function serializeDailySchedule(schedule: Partial<DailySchedule>) {
  const pagi = normalizeTime(schedule.pagi, DEFAULT_DAILY_SCHEDULE.pagi);
  const sore = normalizeTime(schedule.sore, DEFAULT_DAILY_SCHEDULE.sore);
  return `${pagi},${sore}`;
}

export function formatDailySchedule(value?: string | null) {
  const schedule = parseDailySchedule(value);
  return `Pagi ${schedule.pagi} dan Sore ${schedule.sore}`;
}
