import type { SupabaseClient } from '@supabase/supabase-js';

/** id phòng Ban Giám đốc (departments.code = 'BGD'); null nếu chưa có. */
export async function getBgdDepartmentId(supabase: SupabaseClient<any, any, any>): Promise<string | null> {
  const { data } = await supabase.from('departments').select('id').eq('code', 'BGD').maybeSingle();
  return data?.id ?? null;
}
