// Luôn format theo giờ Việt Nam (UTC+7), bất kể server chạy ở múi giờ nào
// (Vercel/Node mặc định chạy UTC, nếu không chỉ định timeZone thì giờ hiển thị
// sẽ bị lệch 7 tiếng so với thực tế cho người dùng ở Việt Nam).
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatDateVN(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleDateString('vi-VN', { timeZone: VN_TIME_ZONE });
}

export function formatTimeVN(input: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleTimeString('vi-VN', { timeZone: VN_TIME_ZONE, hour12: false, ...opts });
}

export function formatDateTimeVN(input: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleString('vi-VN', { timeZone: VN_TIME_ZONE, hour12: false, ...opts });
}
