import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function ensureSystemOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD?.trim();
  const fullName = process.env.OWNER_NAME?.trim() || 'System Owner';

  if (!email || !password) return null;

  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      full_name: fullName,
      role: 'owner',
      brand_id: null,
      brand_name: null,
      is_active: true,
    },
    create: {
      email,
      password: passwordHash,
      full_name: fullName,
      role: 'owner',
      brand_id: null,
      brand_name: null,
      is_active: true,
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      brand_id: true,
      brand_name: true,
      is_active: true,
    },
  });
}
