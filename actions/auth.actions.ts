'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isValidUsername, usernameToInternalEmail } from '@/lib/auth/username';
import { requireUser } from '@/lib/auth/current-user';
import { logAudit } from '@/lib/audit/log';

export async function loginAction(formData: FormData) {
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');

  if (!username || !password) {
    return { error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
  }
  if (!isValidUsername(username)) {
    return { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToInternalEmail(username),
    password
  });

  if (error) {
    return { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Cho phép người dùng đang đăng nhập tự đổi mật khẩu của chính mình.
 * Khác với updateUserAction (admin đổi mật khẩu người khác qua service role),
 * hàm này dùng client phiên đăng nhập hiện tại (anon key + cookie) và BẮT BUỘC
 * xác thực lại mật khẩu hiện tại trước khi cho đổi, để tránh trường hợp ai đó
 * chiếm được phiên đăng nhập (session) đang mở nhưng không biết mật khẩu thật.
 */
export async function changePasswordAction(formData: FormData) {
  const { authId, profile } = await requireUser();

  const currentPassword = String(formData.get('currentPassword') || '');
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Vui lòng nhập đầy đủ thông tin.' };
  }
  if (newPassword.length < 8) {
    return { error: 'Mật khẩu mới tối thiểu 8 ký tự.' };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Xác nhận mật khẩu mới không khớp.' };
  }
  if (newPassword === currentPassword) {
    return { error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' };
  }

  const supabase = createServerSupabase();

  // Xác thực lại mật khẩu hiện tại: gọi lại signInWithPassword đúng như lúc đăng nhập.
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: usernameToInternalEmail(profile.username),
    password: currentPassword
  });
  if (verifyErr) {
    return { error: 'Mật khẩu hiện tại không đúng.' };
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) {
    return { error: 'Không đổi được mật khẩu: ' + updateErr.message };
  }

  await logAudit({ userId: authId, action: 'CHANGE_OWN_PASSWORD', entityType: 'profile', entityId: authId });
  return { success: true };
}
