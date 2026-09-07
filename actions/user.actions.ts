'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { canManageOrg } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';
import { isValidUsername, normalizeUsername, usernameToInternalEmail } from '@/lib/auth/username';
import type { UserRole } from '@/types/user';

/**
 * Tạo user mới: dùng Supabase Auth Admin API (service role, CHỈ chạy trên server).
 * "Tên đăng nhập" do admin đặt được ánh xạ sang 1 email nội bộ (không có thật)
 * để Supabase Auth lưu, người dùng không bao giờ thấy/nhập email này.
 * Sau khi tạo auth.users, ghi thêm dòng profiles tương ứng.
 */
export async function createUserAction(formData: FormData) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được tạo người dùng.' };

  const usernameRaw = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  const full_name = String(formData.get('full_name') || '').trim();
  const department_id = String(formData.get('department_id') || '');
  const role = String(formData.get('role') || 'MEMBER') as UserRole;
  const position = String(formData.get('position') || '');

  if (!usernameRaw || !password || !full_name || !department_id) {
    return { error: 'Vui lòng nhập đầy đủ thông tin.' };
  }
  if (!isValidUsername(usernameRaw)) {
    return {
      error: 'Tên đăng nhập không hợp lệ: chỉ chữ thường, số, dấu . _ -, dài 3-30 ký tự, bắt đầu bằng chữ hoặc số.'
    };
  }
  if (password.length < 8) return { error: 'Mật khẩu tối thiểu 8 ký tự.' };

  const username = normalizeUsername(usernameRaw);
  const admin = createAdminSupabase();

  const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) return { error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác.' };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: usernameToInternalEmail(username),
    password,
    email_confirm: true
  });
  if (createErr || !created.user) return { error: 'Không tạo được tài khoản: ' + (createErr?.message ?? '') };

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name,
    username,
    department_id,
    role,
    position
  });
  if (profileErr) {
    // rollback auth user nếu ghi profile thất bại, tránh để lại tài khoản "mồ côi"
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileErr.message };
  }

  await logAudit({ userId: authId, action: 'CREATE_USER', entityType: 'profile', entityId: created.user.id, metadata: { username, role } });
  revalidatePath('/users');
  return { success: true };
}

/**
 * Sửa thông tin user (họ tên, phòng ban, vai trò, chức danh, và đổi mật khẩu nếu cần).
 * Dùng admin client (service role) vì cần cập nhật cả auth.users (mật khẩu) lẫn profiles.
 */
export async function updateUserAction(userId: string, formData: FormData) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được sửa người dùng.' };

  const full_name = String(formData.get('full_name') || '').trim();
  const usernameRaw = String(formData.get('username') || '').trim();
  const department_id = String(formData.get('department_id') || '');
  const role = String(formData.get('role') || '') as UserRole;
  const position = String(formData.get('position') || '');
  const password = String(formData.get('password') || '');

  if (!full_name || !usernameRaw || !department_id || !role) {
    return { error: 'Vui lòng nhập đầy đủ thông tin.' };
  }
  if (!isValidUsername(usernameRaw)) {
    return {
      error: 'Tên đăng nhập không hợp lệ: chỉ chữ thường, số, dấu . _ -, dài 3-30 ký tự, bắt đầu bằng chữ hoặc số.'
    };
  }
  if (password && password.length < 8) {
    return { error: 'Mật khẩu tối thiểu 8 ký tự.' };
  }
  // Không cho tự hạ quyền/khoá chính mình khỏi vai trò ADMIN để tránh khoá luôn quản trị hệ thống.
  if (userId === authId && role !== 'ADMIN') {
    return { error: 'Không thể tự thay đổi vai trò ADMIN của chính mình.' };
  }

  const username = normalizeUsername(usernameRaw);
  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', userId)
    .maybeSingle();
  if (existing) return { error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác.' };

  // Nếu đổi username, phải đồng bộ lại email nội bộ trong auth.users (chính là "định danh đăng nhập" thật).
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: usernameToInternalEmail(username),
    ...(password ? { password } : {})
  });
  if (authErr) return { error: 'Không cập nhật được tài khoản đăng nhập: ' + authErr.message };

  const { error } = await admin
    .from('profiles')
    .update({ full_name, username, department_id, role, position })
    .eq('id', userId);
  if (error) return { error: error.message };

  await logAudit({
    userId: authId,
    action: 'UPDATE_USER',
    entityType: 'profile',
    entityId: userId,
    metadata: { full_name, username, department_id, role, password_changed: !!password }
  });
  revalidatePath('/users');
  return { success: true };
}

/**
 * Xoá user. Dùng auth admin API -> profiles bị xoá theo (on delete cascade).
 * Nếu user đã tạo dữ liệu (cuộc họp, bình luận, tài liệu...) thì việc xoá sẽ
 * bị chặn bởi ràng buộc khoá ngoại để bảo toàn dấu vết -> hướng dẫn vô hiệu hoá thay thế.
 */
export async function deleteUserAction(userId: string) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được xoá người dùng.' };
  if (userId === authId) return { error: 'Không thể tự xoá chính mình.' };

  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    const isFkViolation = /foreign key|violates|constraint/i.test(error.message);
    return {
      error: isFkViolation
        ? 'Không thể xoá: người dùng này đã có dữ liệu liên quan (cuộc họp, bình luận, tài liệu...). Hãy vô hiệu hoá tài khoản thay vì xoá.'
        : 'Không xoá được người dùng: ' + error.message
    };
  }

  await logAudit({ userId: authId, action: 'DELETE_USER', entityType: 'profile', entityId: userId });
  revalidatePath('/users');
  return { success: true };
}

export async function toggleUserActiveAction(userId: string, active: boolean) {
  const { authId, profile } = await requireUser();
  if (!canManageOrg(profile)) return { error: 'Chỉ quản trị viên mới được thực hiện.' };
  if (userId === authId && !active) return { error: 'Không thể tự vô hiệu hoá chính mình.' };

  const supabase = createServerSupabase();
  const { error } = await supabase.from('profiles').update({ active }).eq('id', userId);
  if (error) return { error: error.message };

  await logAudit({ userId: authId, action: active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', entityType: 'profile', entityId: userId });
  revalidatePath('/users');
  return { success: true };
}
