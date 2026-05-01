import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';

export default async function RootPage() {
  const user = await getServerSession();
  if (!user) redirect('/login');
  redirect('/dashboard');
}
