import { createServerSupabase } from '@/lib/supabase/server';
import type { Profile } from '@/types/user';
import { redirect } from 'next/navigation';

export async function getCurrentUser(): Promise<{
  authId: string;
  profile: Profile;
} | null> {
  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return { authId: user.id, profile: profile as unknown as Profile };
}

/** Dùng ở đầu Server Action/Page cần bắt buộc đăng nhập */
export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect('/login');
  return current;
}
