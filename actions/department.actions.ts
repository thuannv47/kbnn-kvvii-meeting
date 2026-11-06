'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { createAdminSupabase } from '@/lib/supabase/admin';
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

/** Mã phòng Ban Giám đốc được hệ thống dùng để nhận diện quy tắc xem cuộc họp (xem 0013) -> không cho đổi mã/xoá/ngừng. */
const PROTECTED_CODES = ['BGD'];

export async function updateDepartmentAction(
  id: string,
  input: { code: string; name: string; department_type: string }
) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được sửa phòng ban.' };

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  const department_type = input.department_type === 'BRANCH' ? 'BRANCH' : 'HEAD_OFFICE';
  if (!code || !name) return { error: 'Vui lòng nhập đủ mã và tên phòng ban.' };

  const supabase = createServerSupabase();
  const { data: current } = await supabase.from('departments').select('code').eq('id', id).maybeSingle();
  if (!current) return { error: 'Không tìm thấy phòng ban.' };
  if (PROTECTED_CODES.includes(current.code) && code !== current.code) {
    return { error: `Không được đổi mã của phòng "${current.code}" vì hệ thống dùng mã này để nhận diện Ban Giám đốc.` };
  }

  const { data, error } = await supabase
    .from('departments')
    .update({ code, name, department_type })
    .eq('id', id)
    .select('id');
  if (error) {
    return { error: error.code === '23505' ? `Mã "${code}" đã tồn tại, vui lòng chọn mã khác.` : error.message };
  }
  if (!data || data.length === 0) return { error: 'Không sửa được phòng ban (không đủ quyền hoặc phòng ban không còn tồn tại).' };

  await logAudit({ userId: authId, action: 'UPDATE_DEPARTMENT', entityType: 'department', entityId: id, metadata: { code, name } });
  revalidatePath('/departments');
  revalidatePath('/users');
  return { success: true };
}

export async function toggleDepartmentActiveAction(id: string, active: boolean) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được đổi trạng thái phòng ban.' };

  const supabase = createServerSupabase();
  const { data: current } = await supabase.from('departments').select('code').eq('id', id).maybeSingle();
  if (!current) return { error: 'Không tìm thấy phòng ban.' };
  if (!active && PROTECTED_CODES.includes(current.code)) {
    return { error: `Không được ngừng hoạt động phòng "${current.code}".` };
  }

  const { data, error } = await supabase.from('departments').update({ active }).eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Không đổi được trạng thái phòng ban.' };

  await logAudit({
    userId: authId,
    action: active ? 'ACTIVATE_DEPARTMENT' : 'DEACTIVATE_DEPARTMENT',
    entityType: 'department',
    entityId: id
  });
  revalidatePath('/departments');
  return { success: true };
}

/**
 * Xoá hẳn phòng ban. Chỉ xoá được khi phòng chưa được dùng ở đâu (người dùng, cuộc họp
 * chủ trì, tài liệu, ý kiến) — các bảng này tham chiếu departments(id) KHÔNG cascade nên
 * nếu cứ xoá, Postgres sẽ báo lỗi khoá ngoại khó hiểu. Phòng đã có dữ liệu thì nên chuyển
 * sang "Ngừng hoạt động" để giữ lịch sử.
 */
export async function deleteDepartmentAction(id: string) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được xoá phòng ban.' };

  const supabase = createServerSupabase();
  const { data: dept } = await supabase.from('departments').select('code, name').eq('id', id).maybeSingle();
  if (!dept) return { error: 'Không tìm thấy phòng ban.' };
  if (PROTECTED_CODES.includes(dept.code)) {
    return { error: `Không được xoá phòng "${dept.code}" vì hệ thống dùng để nhận diện Ban Giám đốc.` };
  }

  // Đếm bằng service role để không bị RLS che mất dòng nào (đã kiểm tra quyền ADMIN ở trên).
  const admin = createAdminSupabase();
  const count = async (table: string, column: string) => {
    const { count: c } = await admin.from(table as any).select('id', { count: 'exact', head: true }).eq(column, id);
    return c ?? 0;
  };
  const [users, hosted, docs, comments] = await Promise.all([
    count('profiles', 'department_id'),
    count('meetings', 'host_department_id'),
    count('documents', 'owner_department_id'),
    count('meeting_comments', 'department_id')
  ]);

  const used: string[] = [];
  if (users) used.push(`${users} người dùng`);
  if (hosted) used.push(`${hosted} cuộc họp chủ trì`);
  if (docs) used.push(`${docs} tài liệu`);
  if (comments) used.push(`${comments} ý kiến`);
  if (used.length > 0) {
    return {
      error:
        `Không xoá được "${dept.name}" vì đang được dùng bởi ${used.join(', ')}. ` +
        'Hãy chuyển người dùng sang phòng khác, hoặc bấm "Ngừng" để ẩn phòng ban mà vẫn giữ lịch sử.'
    };
  }

  const { data, error } = await supabase.from('departments').delete().eq('id', id).select('id');
  if (error) return { error: 'Không xoá được phòng ban: ' + error.message };
  if (!data || data.length === 0) return { error: 'Không xoá được phòng ban (không đủ quyền).' };

  await logAudit({ userId: authId, action: 'DELETE_DEPARTMENT', entityType: 'department', entityId: id, metadata: { code: dept.code, name: dept.name } });
  revalidatePath('/departments');
  return { success: true };
}
