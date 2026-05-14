import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import { sendWeeklyReport, formatWeeklyPerformance } from '@/lib/telegram';
import { getCurrentWeek } from '@/lib/utils';

// Helper: get the previous period's week label
// Periods: 1-7, 8-14, 15-21, 22-end
// This is called on H+1 (8, 15, 22, 1) so we look back to the period that just ended
function getPreviousPeriodWeek(): { week_label: string } {
    const now = new Date();
    const wibOffset = 7 * 60;
    const wibTime = new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
    const day = wibTime.getDate();

    let targetDate: Date;

    if (day === 1) {
        // H+1 of last period of previous month — look at previous month's 22-end
        targetDate = new Date(wibTime.getFullYear(), wibTime.getMonth() - 1, 25); // mid of last period
    } else if (day === 8) {
        // H+1 of period 1-7 — look at day 4 (mid of period 1-7)
        targetDate = new Date(wibTime.getFullYear(), wibTime.getMonth(), 4);
    } else if (day === 15) {
        // H+1 of period 8-14 — look at day 11
        targetDate = new Date(wibTime.getFullYear(), wibTime.getMonth(), 11);
    } else if (day === 22) {
        // H+1 of period 15-21 — look at day 18
        targetDate = new Date(wibTime.getFullYear(), wibTime.getMonth(), 18);
    } else {
        // Fallback: use current week (manual trigger)
        targetDate = wibTime;
    }

    return getCurrentWeek(targetDate);
}

// POST - Trigger weekly performance report to Telegram
// Auto-triggered on H+1 after period ends (8, 15, 22, 1) at 07:00 WIB
export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');
    const forceWeekLabel = searchParams.get('week_label'); // optional override

    // Auth: cron secret OR session
    if (cronSecret !== process.env.CRON_SECRET) {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    // Determine which period to report on
    // If called by cron (H+1), use previous period. If manual, use current.
    let weekLabel: string;
    if (forceWeekLabel) {
        weekLabel = forceWeekLabel;
    } else if (cronSecret === process.env.CRON_SECRET) {
        // Called by cron — report on previous period
        weekLabel = getPreviousPeriodWeek().week_label;
    } else {
        // Manual trigger — report on current period
        weekLabel = getCurrentWeek().week_label;
    }

    // Get all submitted weekly reports for this period
    const reports = await prisma.weeklyReport.findMany({
        where: { week_label: weekLabel, status: 'submitted' },
    });

    // Get brands
    const brands = await prisma.brand.findMany({ where: { status: 'active' } });

    const brandPerformance = brands.map(brand => {
        const report = reports.find(r => r.brand_id === brand.id);
        let kpis: { name: string; target: number; actual: number; pct: number; unit: string }[] = [];

        if (report && Array.isArray(report.kpis)) {
            kpis = (report.kpis as { kpi_name: string; target: string; actual: string; pct: number; unit: string }[]).map(k => ({
                name: k.kpi_name,
                target: parseFloat(k.target) || 0,
                actual: parseFloat(k.actual) || 0,
                pct: k.pct || 0,
                unit: k.unit || 'number',
            }));
        }

        const overall_pct = kpis.length > 0
            ? kpis.reduce((sum, k) => sum + k.pct, 0) / kpis.length
            : 0;

        return { name: brand.name, kpis, overall_pct };
    }).filter(b => b.kpis.length > 0);

    if (brandPerformance.length === 0) {
        return NextResponse.json({ ok: false, error: `Belum ada weekly report yang disubmit untuk periode ${weekLabel}` });
    }

    const message = formatWeeklyPerformance({ week_label: weekLabel, brands: brandPerformance });
    const result = await sendWeeklyReport(message);

    return NextResponse.json({ ok: true, week_label: weekLabel, message_preview: message.substring(0, 200), ...result });
}
