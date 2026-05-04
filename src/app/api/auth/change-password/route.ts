import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { current_password, new_password } = await req.json();

        if (!current_password || !new_password) {
            return NextResponse.json({ error: 'Password lama dan password baru wajib diisi' }, { status: 400 });
        }

        if (new_password.length < 6) {
            return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        const valid = await bcrypt.compare(current_password, user.password);
        if (!valid) {
            return NextResponse.json({ error: 'Password lama salah' }, { status: 401 });
        }

        const hashed = await bcrypt.hash(new_password, 10);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashed },
        });

        return NextResponse.json({ message: 'Password berhasil diubah' });
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
