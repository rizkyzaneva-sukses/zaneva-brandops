import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sessionOptions, SessionData } from '@/lib/session';

// PATCH /api/users/[id] — Update user name or toggle active status (owner only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user || session.user.role !== 'owner') {
            return NextResponse.json({ error: 'Forbidden — hanya owner' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        const updates: { is_active?: boolean; full_name?: string } = {};

        if (typeof body.full_name === 'string') {
            const fullName = body.full_name.trim();
            if (!fullName) {
                return NextResponse.json({ error: 'Nama user tidak boleh kosong' }, { status: 400 });
            }
            updates.full_name = fullName;
        }

        if (typeof body.is_active === 'boolean') {
            // Prevent owner from deactivating themselves
            if (id === session.user.id && body.is_active === false) {
                return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 });
            }
            updates.is_active = body.is_active;
        } else if (!updates.full_name) {
            if (id === session.user.id) {
                return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 });
            }
            updates.is_active = !user.is_active;
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updates,
            select: { id: true, email: true, full_name: true, role: true, brand_id: true, brand_name: true, is_active: true },
        });

        if (id === session.user.id && updated.full_name !== session.user.full_name) {
            session.user.full_name = updated.full_name;
            await session.save();
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Toggle user status error:', error);
        return NextResponse.json({ error: 'Gagal mengubah status user' }, { status: 500 });
    }
}

// DELETE /api/users/[id] — Delete user permanently (owner only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.user || session.user.role !== 'owner') {
            return NextResponse.json({ error: 'Forbidden — hanya owner' }, { status: 403 });
        }

        const { id } = await params;

        // Prevent owner from deleting themselves
        if (id === session.user.id) {
            return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
        }

        // Delete related records first (standups, daily_reports)
        await prisma.standup.deleteMany({ where: { user_id: id } });
        await prisma.dailyReport.deleteMany({ where: { user_id: id } });

        // Delete the user
        await prisma.user.delete({ where: { id } });

        return NextResponse.json({ message: `User "${user.full_name}" berhasil dihapus` });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Gagal menghapus user' }, { status: 500 });
    }
}
