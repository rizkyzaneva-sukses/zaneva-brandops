import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DailySprintSession, DEFAULT_DAILY_SCHEDULE, parseDailySchedule } from '@/lib/telegramSchedule';

const WEEKLY_REPORT_DAY = 1; // Monday
const DEFAULT_WEEKLY_REPORT_TIME = '10:30';
const DEFAULT_CRON_TOLERANCE_MINUTES = 10;

function parseTimeToMinutes(time: string) {
    const [hour = '0', minute = '0'] = time.split(':');
    return Number(hour) * 60 + Number(minute);
}

function isDueWithinWindow(scheduleTime: string, currentMinutes: number, toleranceMinutes: number) {
    const diff = currentMinutes - parseTimeToMinutes(scheduleTime);
    return diff >= 0 && diff <= toleranceMinutes;
}

function getWibDateKey(wibTime: Date) {
    return `${wibTime.getFullYear()}-${String(wibTime.getMonth() + 1).padStart(2, '0')}-${String(wibTime.getDate()).padStart(2, '0')}`;
}

function getScheduledUtcFromWib(wibTime: Date, time: string) {
    const [hour = '0', minute = '0'] = time.split(':');
    return new Date(Date.UTC(wibTime.getFullYear(), wibTime.getMonth(), wibTime.getDate(), Number(hour) - 7, Number(minute), 0, 0));
}

async function reserveDelivery(deliveryKey: string, deliveryType: string, configIds: string[], scheduledFor: Date) {
    try {
        await prisma.telegramDeliveryLog.create({
            data: {
                delivery_key: deliveryKey,
                delivery_type: deliveryType,
                telegram_config_ids: configIds.join(','),
                scheduled_for: scheduledFor,
                result: { status: 'reserved' },
            },
        });
        return true;
    } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2002') {
            return false;
        }
        throw error;
    }
}

async function markDelivery(deliveryKey: string, result: Prisma.InputJsonValue) {
    await prisma.telegramDeliveryLog.update({
        where: { delivery_key: deliveryKey },
        data: { result },
    });
}

async function releaseDeliveries(deliveryKeys: string[]) {
    if (deliveryKeys.length === 0) return;
    await prisma.telegramDeliveryLog.deleteMany({
        where: { delivery_key: { in: deliveryKeys } },
    });
}

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
    const currentMinutes = currentHour * 60 + currentMinute;
    const currentDateKey = getWibDateKey(wibTime);
    const isWeeklyReportDay = currentWeekday === WEEKLY_REPORT_DAY;
    const configuredTolerance = Number(process.env.CRON_TOLERANCE_MINUTES || DEFAULT_CRON_TOLERANCE_MINUTES);
    const toleranceMinutes = Number.isFinite(configuredTolerance) && configuredTolerance >= 0
        ? configuredTolerance
        : DEFAULT_CRON_TOLERANCE_MINUTES;

    // Clean up stale failed delivery logs from today so they can be retried
    await prisma.telegramDeliveryLog.deleteMany({
        where: {
            delivery_key: { startsWith: `daily:${currentDateKey}:` },
            result: { path: ['status'], equals: 'failed' },
        },
    });
    await prisma.telegramDeliveryLog.deleteMany({
        where: {
            delivery_key: { startsWith: `weekly:${currentDateKey}:` },
            result: { path: ['status'], equals: 'failed' },
        },
    });

    // Get active configs and check schedules
    const configs = await prisma.telegramConfig.findMany({ where: { is_active: true } });

    const dailyConfigIdsBySession: Record<DailySprintSession, Set<string>> = {
        pagi: new Set<string>(),
        sore: new Set<string>(),
    };
    const dailyDeliveryKeysBySession: Record<DailySprintSession, string[]> = {
        pagi: [],
        sore: [],
    };
    const weeklyConfigIds = new Set<string>();
    const weeklyDeliveryKeys: string[] = [];

    for (const config of configs) {
        const dailySchedule = parseDailySchedule(config.schedule_daily);

        for (const session of ['pagi', 'sore'] as const) {
            const scheduledTime = dailySchedule[session];
            if (!isDueWithinWindow(scheduledTime, currentMinutes, toleranceMinutes)) continue;

            const deliveryKey = `daily:${currentDateKey}:${session}:${config.id}`;
            const reserved = await reserveDelivery(deliveryKey, 'daily-summary', [config.id], getScheduledUtcFromWib(wibTime, scheduledTime));
            if (!reserved) continue;

            dailyConfigIdsBySession[session].add(config.id);
            dailyDeliveryKeysBySession[session].push(deliveryKey);
        }

        // Check weekly schedule — Monday only
        if (isWeeklyReportDay && isDueWithinWindow(config.schedule_weekly, currentMinutes, toleranceMinutes)) {
            const deliveryKey = `weekly:${currentDateKey}:${config.id}`;
            const reserved = await reserveDelivery(deliveryKey, 'weekly-report', [config.id], getScheduledUtcFromWib(wibTime, config.schedule_weekly));
            if (!reserved) continue;

            weeklyConfigIds.add(config.id);
            weeklyDeliveryKeys.push(deliveryKey);
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
            const res = await fetch(`${baseUrl}/api/telegram/daily-summary?session=${session}&config_ids=${configIds.join(',')}&secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            const body = await res.json().catch(() => null) as Record<string, unknown> | null;
            const success = res.ok && body?.ok;
            if (success) {
                await Promise.all(dailyDeliveryKeysBySession[session].map(deliveryKey => markDelivery(deliveryKey, {
                    status: 'sent',
                    response: body,
                } as Prisma.InputJsonValue)));
                results.push(`daily-summary ${session} sent (${configIds.length} destination${configIds.length > 1 ? 's' : ''})`);
            } else {
                await releaseDeliveries(dailyDeliveryKeysBySession[session]);
                results.push(`daily-summary ${session} failed: ${String(body?.error || res.statusText)}`);
            }
        } catch (e) {
            await releaseDeliveries(dailyDeliveryKeysBySession[session]);
            results.push(`daily-summary ${session} failed: ` + String(e));
        }
    }

    if (weeklyConfigIds.size > 0) {
        const configIds = [...weeklyConfigIds];

        try {
            const res = await fetch(`${baseUrl}/api/telegram/weekly-report?config_ids=${configIds.join(',')}&secret=${process.env.CRON_SECRET}`, { method: 'POST' });
            const body = await res.json().catch(() => null) as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
            const success = res.ok && body?.ok;
            if (success) {
                await Promise.all(weeklyDeliveryKeys.map(deliveryKey => markDelivery(deliveryKey, {
                    status: 'sent',
                    response: body,
                } as Prisma.InputJsonValue)));
                results.push(`weekly-report sent (${body?.sent || 0} sent, ${body?.failed || 0} failed)`);
            } else {
                await releaseDeliveries(weeklyDeliveryKeys);
                results.push(`weekly-report failed: ${body?.error || res.statusText}`);
            }
        } catch (e) {
            await releaseDeliveries(weeklyDeliveryKeys);
            results.push('weekly-report failed: ' + String(e));
        }
    }

    return NextResponse.json({
        ok: true,
        time_wib: currentTimeStr,
        day: currentDay,
        weekday: currentWeekday,
        tolerance_minutes: toleranceMinutes,
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
