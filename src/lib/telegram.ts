import { prisma } from './prisma';

interface TelegramDestination {
    bot_token: string;
    chat_id: string;
    topic_daily: string | null;
    topic_weekly: string | null;
}

// Send a message to a specific Telegram chat/topic
async function sendTelegramMessage(botToken: string, chatId: string, text: string, topicId?: string | null): Promise<boolean> {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        };
        if (topicId) {
            body.message_thread_id = parseInt(topicId);
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json();
            console.error('[Telegram] Send failed:', err);
            return false;
        }
        return true;
    } catch (error) {
        console.error('[Telegram] Error:', error);
        return false;
    }
}

// Get all active Telegram destinations
export async function getActiveDestinations(): Promise<TelegramDestination[]> {
    const configs = await prisma.telegramConfig.findMany({
        where: { is_active: true },
    });
    return configs.map(c => ({
        bot_token: c.bot_token,
        chat_id: c.chat_id,
        topic_daily: c.topic_daily,
        topic_weekly: c.topic_weekly,
    }));
}

// Send daily summary to all active destinations
export async function sendDailySummary(message: string): Promise<{ sent: number; failed: number }> {
    const destinations = await getActiveDestinations();
    let sent = 0;
    let failed = 0;

    for (const dest of destinations) {
        const ok = await sendTelegramMessage(dest.bot_token, dest.chat_id, message, dest.topic_daily);
        if (ok) sent++;
        else failed++;
    }

    return { sent, failed };
}

// Send weekly report to all active destinations
export async function sendWeeklyReport(message: string): Promise<{ sent: number; failed: number }> {
    const destinations = await getActiveDestinations();
    let sent = 0;
    let failed = 0;

    for (const dest of destinations) {
        const ok = await sendTelegramMessage(dest.bot_token, dest.chat_id, message, dest.topic_weekly);
        if (ok) sent++;
        else failed++;
    }

    return { sent, failed };
}

// Send test message to a specific config
export async function sendTestMessage(configId: string): Promise<boolean> {
    const config = await prisma.telegramConfig.findUnique({ where: { id: configId } });
    if (!config) return false;

    const testMsg = `✅ <b>Test dari Zaneva BrandOps</b>\n\nKoneksi Telegram berhasil!\nDestinasi: ${config.name}\nWaktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Bangkok' })}`;

    // Send to daily topic
    const ok1 = await sendTelegramMessage(config.bot_token, config.chat_id, testMsg, config.topic_daily);
    return ok1;
}

type DailySprintSession = 'pagi' | 'sore';

// Format daily standup summary message
export function formatDailySummary(data: {
    date: string;
    session: DailySprintSession;
    brands: {
        name: string;
        leaders: string[];
        users: { name: string; role: string; pagi: boolean; sore: boolean }[];
    }[];
}): string {
    const lines: string[] = [];
    const isMorning = data.session === 'pagi';
    const title = isMorning ? '🌤️ <b>Report Sprint Pagi</b>' : '🌆 <b>Report Sprint Sore</b>';
    const sessionLabel = isMorning ? 'Sprint Pagi' : 'Sprint Sore';

    lines.push(title);
    lines.push(`📅 ${data.date}`);
    lines.push('');

    let totalMissing = 0;

    for (const brand of data.brands) {
        const missingUsers = brand.users.filter(u => !u[data.session]);
        if (missingUsers.length === 0) continue;

        lines.push(`<b>🏷 ${brand.name}</b>`);
        if (brand.leaders.length > 0) {
            lines.push(`👤 Leader: <b>${brand.leaders.join(', ')}</b>`);
            lines.push(`Tolong bantu follow up timnya ya 🙏`);
        } else {
            lines.push('👤 Leader: <i>Belum diset</i>');
        }
        lines.push('');
        for (const user of missingUsers) {
            lines.push(`• ${user.name}`);
            totalMissing++;
        }
        lines.push('');
    }

    if (totalMissing === 0) {
        lines.push('Alhamdulillah Done All ✅🎉');
    } else {
        lines.push(`Yuk dilengkapi ${sessionLabel}-nya ya teman-teman 🙏✨`);
    }

    return lines.join('\n');
}

// Format weekly performance message
export function formatWeeklyPerformance(data: {
    week_label: string;
    brands: {
        name: string;
        kpis: { name: string; target: number; actual: number; pct: number; unit: string }[];
        overall_pct: number;
    }[];
}): string {
    const lines: string[] = [];
    lines.push(`📊 <b>Weekly Performance Report</b>`);
    lines.push(`📅 ${data.week_label}`);
    lines.push('');

    for (const brand of data.brands) {
        const statusIcon = brand.overall_pct >= 100 ? '🟢' : brand.overall_pct >= 80 ? '🟡' : '🔴';
        lines.push(`<b>${statusIcon} ${brand.name}</b> — ${brand.overall_pct.toFixed(0)}% overall`);

        for (const kpi of brand.kpis) {
            const icon = kpi.pct >= 100 ? '✅' : kpi.pct >= 80 ? '⚠️' : '❌';
            const actualStr = kpi.unit === 'currency' ? formatRp(kpi.actual) : kpi.actual.toLocaleString('id-ID');
            const targetStr = kpi.unit === 'currency' ? formatRp(kpi.target) : kpi.target.toLocaleString('id-ID');
            lines.push(`  ${icon} ${kpi.name}: ${actualStr}/${targetStr} (${kpi.pct.toFixed(0)}%)`);
        }
        lines.push('');
    }

    // Top performer
    const sorted = [...data.brands].sort((a, b) => b.overall_pct - a.overall_pct);
    if (sorted.length > 0) {
        lines.push(`🏆 <b>Top:</b> ${sorted[0].name} (${sorted[0].overall_pct.toFixed(0)}%)`);
    }

    // Alert: brands below 80%
    const alerts = data.brands.filter(b => b.overall_pct < 80);
    if (alerts.length > 0) {
        lines.push('');
        lines.push(`⚠️ <b>Perlu perhatian:</b>`);
        for (const a of alerts) {
            lines.push(`  🔴 ${a.name} — ${a.overall_pct.toFixed(0)}%`);
        }
    }

    return lines.join('\n');
}

function formatRp(value: number): string {
    if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}jt`;
    if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}rb`;
    return `Rp${value.toLocaleString('id-ID')}`;
}
