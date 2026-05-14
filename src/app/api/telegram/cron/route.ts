import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Cron endpoint that checks if it's time to send notifications
// Called every minute by Easypanel cron: curl https://domain/api/telegram/cron?secret=YOUR_SECRET
// Or set up in Easypanel to run at specific times
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

    // Get active configs and check schedules
    const configs = await prisma.telegramConfig.findMany({ where: { is_active: true } });

    let dailyTriggered = false;
    let weeklyTriggered = false;

    for (const config of configs) {
        // Check daily schedule (allow 1-minute window)
        if (config.schedule_daily === currentTimeStr && !dailyTriggered) {
            dailyTriggered = true;
        }
        // Check weekly schedule
        if (config.schedule_weekly === currentTimeStr && !weeklyTriggered) {
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
        // Only send weekly on period end days (7, 14, 21, last day of month)
        const day = wibTime.getDate();
        const lastDay = new Date(wibTime.getFullYear(), wibTime.getMonth() + 1, 0).getDate();
        const isPeriodEnd = [7, 14, 21, lastDay].includes(day);

        if (isPeriodEnd) {
            try {
                await fetch(`${baseUrl}/api/telegram/weekly-report?secret=${process.env.CRON_SECRET}`, { method: 'POST' });
                results.push('weekly-report sent');
            } catch (e) {
                results.push('weekly-report failed: ' + String(e));
            }
        }
    }

    return NextResponse.json({
        ok: true,
        time_wib: currentTimeStr,
        triggered: results.length > 0 ? results : 'nothing to send',
    });
}
