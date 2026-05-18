import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DAILY_SPRINT_REPORTS = [
    { session: 'pagi', time: '09:25' },
    { session: 'sore', time: '18:00' },
] as const;

// GET - Cron endpoint that checks if it's time to send notifications
// Called every minute by Easypanel cron: curl https://domain/api/telegram/cron?secret=YOUR_SECRET
// Daily sprint reports: sent at 09:25 WIB for pagi and 18:00 WIB for sore
// Weekly report: sent at schedule_weekly time on H+1 after period ends (8, 15, 22, 1)
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

    // H+1 after period ends: periods end on 7, 14, 21, last day of month
    // So H+1 = 8, 15, 22, 1 (first of next month)
    const isWeeklyReportDay = [1, 8, 15, 22].includes(currentDay);

    // Get active configs and check schedules
    const configs = await prisma.telegramConfig.findMany({ where: { is_active: true } });

    const dailyReport = DAILY_SPRINT_REPORTS.find(report => report.time === currentTimeStr);
    let weeklyTriggered = false;

    for (const config of configs) {
        // Check weekly schedule — only on H+1 after period end
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
        try {
            await fetch(`${baseUrl}/api/telegram/weekly-report?secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            results.push('weekly-report sent');
        } catch (e) {
            results.push('weekly-report failed: ' + String(e));
        }
    }

    return NextResponse.json({
        ok: true,
        time_wib: currentTimeStr,
        day: currentDay,
        is_weekly_report_day: isWeeklyReportDay,
        active_telegram_configs: configs.length,
        daily_report_schedule: DAILY_SPRINT_REPORTS,
        daily_report_session: dailyReport?.session || null,
        triggered: results.length > 0 ? results : 'nothing to send',
    });
}
