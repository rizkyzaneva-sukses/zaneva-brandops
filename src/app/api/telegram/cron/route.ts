import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DailySprintSession, DEFAULT_DAILY_SCHEDULE, parseDailySchedule } from '@/lib/telegramSchedule';

const WEEKLY_REPORT_DAY = 1; // Monday
const DEFAULT_WEEKLY_REPORT_TIME = '10:30';

// GET - Cron endpoint that checks if it's time to send notifications
// Called every minute by Easypanel cron: curl https://domain/api/telegram/cron?secret=YOUR_SECRET
// Daily sprint reports: sent at each destination's configured WIB schedule
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

    const dailyConfigIdsBySession: Record<DailySprintSession, Set<string>> = {
        pagi: new Set<string>(),
        sore: new Set<string>(),
    };
    let weeklyTriggered = false;

    for (const config of configs) {
        const dailySchedule = parseDailySchedule(config.schedule_daily);
        if (dailySchedule.pagi === currentTimeStr) {
            dailyConfigIdsBySession.pagi.add(config.id);
        }
        if (dailySchedule.sore === currentTimeStr) {
            dailyConfigIdsBySession.sore.add(config.id);
        }

        // Check weekly schedule — Monday only
        if (config.schedule_weekly === currentTimeStr && isWeeklyReportDay && !weeklyTriggered) {
            weeklyTriggered = true;
        }
    }

    const results: string[] = [];
    const baseUrl = req.nextUrl.origin;
    const defaultDailySession = Object.entries(DEFAULT_DAILY_SCHEDULE).find(([, time]) => time === currentTimeStr)?.[0] as DailySprintSession | undefined;

    if (defaultDailySession && configs.length === 0) {
        results.push(`daily-summary ${defaultDailySession} skipped: no active Telegram config`);
    }

    for (const session of ['pagi', 'sore'] as const) {
        const configIds = [...dailyConfigIdsBySession[session]];
        if (configIds.length === 0) continue;

        try {
            await fetch(`${baseUrl}/api/telegram/daily-summary?session=${session}&config_ids=${configIds.join(',')}&secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            results.push(`daily-summary ${session} sent (${configIds.length} destination${configIds.length > 1 ? 's' : ''})`);
        } catch (e) {
            results.push(`daily-summary ${session} failed: ` + String(e));
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
        daily_report_schedule: configs.map(config => ({
            config_id: config.id,
            name: config.name,
            ...parseDailySchedule(config.schedule_daily),
        })),
        daily_report_sessions: (['pagi', 'sore'] as const).filter(session => dailyConfigIdsBySession[session].size > 0),
        weekly_report_schedule: {
            day: 'monday',
            default_time: DEFAULT_WEEKLY_REPORT_TIME,
            configured_times: [...new Set(configs.map(config => config.schedule_weekly))],
        },
        triggered: results.length > 0 ? results : 'nothing to send',
    });
}
