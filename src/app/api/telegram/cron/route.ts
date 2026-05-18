import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DAILY_SPRINT_REPORTS = [
    { session: 'pagi', time: '09:25' },
    { session: 'sore', time: '18:00' },
] as const;
const WEEKLY_REPORT_DAY = 1; // Monday
const DEFAULT_WEEKLY_REPORT_TIME = '10:30';

// GET - Cron endpoint that checks if it's time to send notifications
// Called every minute by Easypanel cron: curl https://domain/api/telegram/cron?secret=YOUR_SECRET
// Daily sprint reports: sent at 09:25 WIB for pagi and 18:00 WIB for sore
// Weekly report: sent every Monday at schedule_weekly time
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current time in WIB (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60; // minutes
    const wibTime = new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
    const currentHour = wibTime.getHours();
    const currentMinute = wibTime.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    const currentDay = wibTime.getDate();
    const currentWeekday = wibTime.getDay();
    const isWeeklyReportDay = currentWeekday === WEEKLY_REPORT_DAY;

    // Get active configs and check schedules
    const configs = await prisma.telegramConfig.findMany({ where: { is_active: true } });

    const dailyReport = DAILY_SPRINT_REPORTS.find(report => report.time === currentTimeStr);
    let weeklyTriggered = false;

    for (const config of configs) {
        // Check weekly schedule — Monday only
        if (config.schedule_weekly === currentTimeStr && isWeeklyReportDay && !weeklyTriggered) {
            weeklyTriggered = true;
        }
    }

    const results: string[] = [];
    const baseUrl = req.nextUrl.origin;

    if (dailyReport && configs.length === 0) {
        results.push(`daily-summary ${dailyReport.session} skipped: no active Telegram config`);
    }

    if (dailyReport && configs.length > 0) {
        try {
            await fetch(`${baseUrl}/api/telegram/daily-summary?session=${dailyReport.session}&secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            results.push(`daily-summary ${dailyReport.session} sent`);
        } catch (e) {
            results.push(`daily-summary ${dailyReport.session} failed: ` + String(e));
        }
    }

    if (weeklyTriggered) {
        if (configs.length === 0) {
            results.push('weekly-report skipped: no active Telegram config');
        }

        try {
            const res = await fetch(`${baseUrl}/api/telegram/weekly-report?secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            const body = await res.json().catch(() => null) as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
            if (res.ok && body?.ok) {
                results.push(`weekly-report sent (${body.sent || 0} sent, ${body.failed || 0} failed)`);
            } else {
                results.push(`weekly-report failed: ${body?.error || res.statusText}`);
            }
        } catch (e) {
            results.push('weekly-report failed: ' + String(e));
        }
    }

    return NextResponse.json({
        ok: true,
        time_wib: currentTimeStr,
        day: currentDay,
        weekday: currentWeekday,
        is_weekly_report_day: isWeeklyReportDay,
        active_telegram_configs: configs.length,
        daily_report_schedule: DAILY_SPRINT_REPORTS,
        daily_report_session: dailyReport?.session || null,
        weekly_report_schedule: {
            day: 'monday',
            default_time: DEFAULT_WEEKLY_REPORT_TIME,
            configured_times: [...new Set(configs.map(config => config.schedule_weekly))],
        },
        triggered: results.length > 0 ? results : 'nothing to send',
    });
}
