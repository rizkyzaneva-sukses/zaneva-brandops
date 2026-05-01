import { requireAuth } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return <AppShell user={user}>{children}</AppShell>;
}
