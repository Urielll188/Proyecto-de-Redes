import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { MallasClientHub } from '@/components/dashboard/mallas/MallasClientHub';

export const dynamic = 'force-dynamic';

export default async function MallasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <MallasClientHub />;
}
