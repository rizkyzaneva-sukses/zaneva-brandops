import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

// GET - Get attendance data for a date range
export async function GET(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brand_id') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';

    if (!dateFrom || !dateTo) {
        return NextResponse.json({ error: 'date_from and date_to required' }, { status: 400 });
    }

    // Get users
    const userWhere: Record<string, unknown> = { is_active: true };
    if (brandId) userWhere.brand_id = brandId;
    if (!['owner', 'admin'].includes(session.user.role) && session.user.brand_id) {
        userWhere.brand_id = session.user.brand_id;
    }

    const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true, full_name: true, role: true, brand_id: true, brand_name: true },
        orderBy: [{ brand_name: 'asc' }, { full_name: 'asc' }],
    });

    // Get standups in range
    const standups = await prisma.standup.findMany({
        where: {
            standup_date: { gte: new Date(dateFrom + 'T00:00:00'), lte: new Date(dateTo + 'T23:59:59') },
            status: 'submitted',
            ...(brandId ? { brand_id: brandId } : {}),
            ...(!['owner', 'admin'].includes(session.user.role) && session.user.brand_id ? { brand_id: session.user.brand_id } : {}),
        },
        select: { user_id: true, session: true, standup_date: true },
    });

    // Generate date list
    const dates: string[] = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Skip weekends (Saturday=6, Sunday=0)
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
            dates.push(d.toISOString().split('T')[0]);
        }
    }

    // Build attendance grid
    const attendance = users.map(user => {
        const userStandups = standups.filter(s => s.user_id === user.id);
        const days: Record<string, { pagi: boolean; sore: boolean }> = {};
        let totalPagi = 0;
        let totalSore = 0;

        for (const date of dates) {
            const pagi = userStandups.some(s => s.session === 'pagi' && s.standup_date.toISOString().split('T')[0] === date);
            const sore = userStandups.some(s => s.session === 'sore' && s.standup_date.toISOString().split('T')[0] === date);
            days[date] = { pagi, sore };
            if (pagi) totalPagi++;
            if (sore) totalSore++;
        }

        const totalDays = dates.length;
        const pctPagi = totalDays > 0 ? Math.round((totalPagi / totalDays) * 100) : 0;
        const pctSore = totalDays > 0 ? Math.round((totalSore / totalDays) * 100) : 0;
        const pctTotal = totalDays > 0 ? Math.round(((totalPagi + totalSore) / (totalDays * 2)) * 100) : 0;

        return {
            user_id: user.id,
            full_name: user.full_name,
            role: user.role,
            brand_name: user.brand_name || '',
            days,
            totalPagi,
            totalSore,
            totalDays,
            pctPagi,
            pctSore,
            pctTotal,
        };
    });

    return NextResponse.json({ dates, attendance });
}
