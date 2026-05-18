import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import { sendDailySummary, formatDailySummary, formatDailyPicReminder } from '@/lib/telegram';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

type DailySprintSession = 'pagi' | 'sore';

function getWibDate() {
    const now = new Date();
    const wibOffsetMinutes = 7 * 60;
    return new Date(now.getTime() + (wibOffsetMinutes + now.getTimezoneOffset()) * 60000);
}

function resolveSession(value: string | null, wibDate: Date): DailySprintSession {
    if (value === 'pagi' || value === 'sore') return value;
    return wibDate.getHours() < 12 ? 'pagi' : 'sore';
}

// POST - Trigger daily standup summary to Telegram
// Can be called by cron (with ?secret=) or manually from UI (with session)
export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');

    // Auth: cron secret OR session
    if (cronSecret !== process.env.CRON_SECRET) {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const today = getWibDate();
    const todayStr = format(today, 'yyyy-MM-dd');
    const dateLabel = format(today, 'EEEE, d MMMM yyyy', { locale: idLocale });
    const session = resolveSession(searchParams.get('session'), today);

    // Get all active brands
    const brands = await prisma.brand.findMany({ where: { status: 'active' } });
    const allUsers = await prisma.user.findMany({ where: { is_active: true } });

    // Get today's standups
    const todayStandups = await prisma.standup.findMany({
        where: {
            standup_date: { gte: new Date(todayStr + 'T00:00:00'), lte: new Date(todayStr + 'T23:59:59') },
            status: 'submitted',
        },
    });

    // Build summary data
    const brandData = brands.map(brand => {
        const brandUsers = allUsers.filter(u => u.brand_id === brand.id);
        const users = brandUsers.map(u => ({
            name: u.full_name,
            role: u.role,
            pagi: todayStandups.some(s => s.user_id === u.id && s.session === 'pagi'),
            sore: todayStandups.some(s => s.user_id === u.id && s.session === 'sore'),
        }));
        return { name: brand.name, users };
    }).filter(b => b.users.length > 0);

    const message = formatDailySummary({ date: dateLabel, session, brands: brandData });
    const picMessage = formatDailyPicReminder({ date: dateLabel, session, brands: brandData });
    const result = await sendDailySummary(message, picMessage);

    return NextResponse.json({ ok: true, session, message_preview: message.substring(0, 200), ...result });
}
