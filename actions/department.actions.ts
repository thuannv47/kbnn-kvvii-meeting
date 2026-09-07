'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { canManageOrg } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';

export async function createDepartmentAction(formData: FormData) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được thêm phòng ban.' };

  const code = String(formData.get('code') || '').trim().toUpperCase();
  const name = String(formData.get('name') || '').trim();
  const department_type = String(formData.get('department_type') || 'HEAD_OFFICE');

  if (!code || !name) return { error: 'Vui lòng nhập đủ mã và tên phòng ban.' };

  const supabase = createServerSupabase();
  const { error } = await supabase.from('departments').insert({ code, name, department_type });
  if (error) return { error: error.message };

  await logAudit({ userId: authId, action: 'CREATE_DEPARTMENT', entityType: 'department', metadata: { code, name } });
  revalidatePath('/departments');
  return { success: true };
}
