import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData, SessionUser } from './session';
import { redirect } from 'next/navigation';

export async function getServerSession(): Promise<SessionUser | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session.user || null;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getServerSession();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(allowedRoles: string[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes('all') && !allowedRoles.includes(user.role)) {
    redirect('/');
  }
  return user;
}
