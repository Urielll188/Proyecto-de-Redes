import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PanelFacilView } from '@/components/dashboard/facil/PanelFacilView';

export const dynamic = 'force-dynamic';

export default async function PanelFacilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <PanelFacilView />;
}
