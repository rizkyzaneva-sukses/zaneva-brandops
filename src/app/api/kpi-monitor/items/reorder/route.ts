import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    // Update order_num for each KPI item
    const updates = items.map((item: { id: string; order_num: number }) =>
        prisma.kpiItem.update({
            where: { id: item.id },
            data: { order_num: item.order_num },
        })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true, message: 'Urutan KPI berhasil diperbarui' });
}
