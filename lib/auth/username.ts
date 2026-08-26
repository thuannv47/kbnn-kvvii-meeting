/**
 * Supabase Auth chỉ hỗ trợ đăng nhập bằng email (hoặc phone) chứ không có khái
 * niệm "username" gốc. Để người dùng chỉ cần nhập "Tên đăng nhập" (không phải
 * email thật), ta ánh xạ 1-1: username -> email nội bộ dạng
 * "<username>@<AUTH_EMAIL_DOMAIN>", lưu email này trong auth.users như bình
 * thường, còn "username" thật thì lưu ở profiles.username để hiển thị/quản lý.
 *
 * Domain này KHÔNG cần tồn tại thật (không gửi mail đi đâu cả) — chỉ cần đúng
 * định dạng email để Supabase Auth chấp nhận.
 */
export const AUTH_EMAIL_DOMAIN = process.env.AUTH_EMAIL_DOMAIN || 'accounts.meeting-system.local';

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_REGEX.test(normalizeUsername(raw));
}

export function usernameToInternalEmail(raw: string): string {
  return `${normalizeUsername(raw)}@${AUTH_EMAIL_DOMAIN}`;
}
