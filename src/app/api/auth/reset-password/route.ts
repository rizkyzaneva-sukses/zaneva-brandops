import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user || !['owner', 'admin'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { user_id, new_password } = await req.json();

        if (!user_id || !new_password) {
            return NextResponse.json({ error: 'User ID dan password baru wajib diisi' }, { status: 400 });
        }

        if (new_password.length < 6) {
            return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: user_id } });
        if (!targetUser) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        // Only owner can reset another owner's password
        if (targetUser.role === 'owner' && session.user.role !== 'owner') {
            return NextResponse.json({ error: 'Hanya owner yang bisa reset password owner lain' }, { status: 403 });
        }

        const hashed = await bcrypt.hash(new_password, 10);
        await prisma.user.update({
            where: { id: user_id },
            data: { password: hashed },
        });

        return NextResponse.json({ message: `Password ${targetUser.full_name} berhasil direset` });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
