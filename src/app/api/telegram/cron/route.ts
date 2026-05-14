import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Cron endpoint that checks if it's time to send notifications
// Called every minute by Easypanel cron: curl https://domain/api/telegram/cron?secret=YOUR_SECRET
// Daily summary: sent at schedule_daily time every day
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

    let dailyTriggered = false;
    let weeklyTriggered = false;

    for (const config of configs) {
        // Check daily schedule (allow 1-minute window)
        if (config.schedule_daily === currentTimeStr && !dailyTriggered) {
            dailyTriggered = true;
        }
        // Check weekly schedule — only on H+1 after period end
        if (config.schedule_weekly === currentTimeStr && isWeeklyReportDay && !weeklyTriggered) {
            weeklyTriggered = true;
        }
    }

    const results: string[] = [];
    const baseUrl = req.nextUrl.origin;

    if (dailyTriggered) {
        try {
            await fetch(`${baseUrl}/api/telegram/daily-summary?secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            results.push('daily-summary sent');
        } catch (e) {
            results.push('daily-summary failed: ' + String(e));
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
        triggered: results.length > 0 ? results : 'nothing to send',
    });
}
