import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import { sendWeeklyReport, formatWeeklyPerformance } from '@/lib/telegram';
import { getCurrentWeek } from '@/lib/utils';

function getWibDate() {
    const now = new Date();
    const wibOffset = 7 * 60;
    return new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
}

// POST - Trigger weekly performance report to Telegram
// Auto-triggered every Monday at schedule_weekly time
export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');
    const forceWeekLabel = searchParams.get('week_label'); // optional override
    const configIds = searchParams.get('config_ids')?.split(',').map(id => id.trim()).filter(Boolean);

    // Auth: cron secret OR session
    if (cronSecret !== process.env.CRON_SECRET) {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    // Determine which period to report on.
    // Cron and manual trigger use the current Zaneva period unless overridden.
    let weekLabel: string;
    if (forceWeekLabel) {
        weekLabel = forceWeekLabel;
    } else {
        weekLabel = getCurrentWeek(getWibDate()).week_label;
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
    const result = await sendWeeklyReport(message, configIds);

    return NextResponse.json({ ok: result.sent > 0, week_label: weekLabel, message_preview: message.substring(0, 200), ...result });
}
