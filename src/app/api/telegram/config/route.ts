import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';
import { sendTestMessage } from '@/lib/telegram';
import { parseDailySchedule, serializeDailySchedule } from '@/lib/telegramSchedule';

// GET - List all telegram configs
export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.telegramConfig.findMany({
        orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(configs);
}

// POST - Create or update telegram config
export async function POST(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, bot_token, chat_id, topic_daily, topic_weekly, daily_pic_dwi_chat_id, daily_pic_kania_chat_id, is_active, schedule_daily, schedule_weekly } = body;

    if (!name || !bot_token || !chat_id) {
        return NextResponse.json({ error: 'name, bot_token, dan chat_id wajib diisi' }, { status: 400 });
    }

    const normalizedScheduleDaily = serializeDailySchedule(parseDailySchedule(schedule_daily));

    if (id) {
        const updated = await prisma.telegramConfig.update({
            where: { id },
            data: { name, bot_token, chat_id, topic_daily: topic_daily || null, topic_weekly: topic_weekly || null, daily_pic_dwi_chat_id: daily_pic_dwi_chat_id || null, daily_pic_kania_chat_id: daily_pic_kania_chat_id || null, is_active: is_active ?? true, schedule_daily: normalizedScheduleDaily, schedule_weekly: schedule_weekly || '10:30' },
        });
        return NextResponse.json(updated);
    } else {
        const created = await prisma.telegramConfig.create({
            data: { name, bot_token, chat_id, topic_daily: topic_daily || null, topic_weekly: topic_weekly || null, daily_pic_dwi_chat_id: daily_pic_dwi_chat_id || null, daily_pic_kania_chat_id: daily_pic_kania_chat_id || null, is_active: is_active ?? true, schedule_daily: normalizedScheduleDaily, schedule_weekly: schedule_weekly || '10:30' },
        });
        return NextResponse.json(created);
    }
}

// DELETE - Remove a telegram config
export async function DELETE(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await prisma.telegramConfig.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}

// PATCH - Test send + diagnose
export async function PATCH(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const config = await prisma.telegramConfig.findUnique({ where: { id } });
    if (!config) return NextResponse.json({ error: 'Config not found' }, { status: 404 });

    // Diagnose: check bot identity and chat access before sending
    let botName = '';
    let chatTitle = '';
    let chatError = '';

    try {
        const meRes = await fetch(`https://api.telegram.org/bot${config.bot_token}/getMe`);
        const meData = await meRes.json() as { ok: boolean; result?: { username?: string; first_name?: string } };
        if (meData.ok && meData.result) {
            botName = meData.result.first_name || meData.result.username || '';
        }
    } catch { /* ignore */ }

    try {
        const chatRes = await fetch(`https://api.telegram.org/bot${config.bot_token}/getChat?chat_id=${config.chat_id}`);
        const chatData = await chatRes.json() as { ok: boolean; result?: { title?: string }; description?: string };
        if (chatData.ok && chatData.result) {
            chatTitle = chatData.result.title || '';
        } else {
            chatError = (chatData as { description?: string }).description || 'Chat not accessible';
        }
    } catch { /* ignore */ }

    const result = await sendTestMessage(id);
    return NextResponse.json({ ...result, bot_name: botName, chat_title: chatTitle, chat_error: chatError });
}
