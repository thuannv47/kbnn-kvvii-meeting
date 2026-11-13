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

/**
 * Ngày đầy đủ kèm thứ, theo giờ Việt Nam: "Thứ 3, ngày 17 tháng 11 năm 2026".
 * Chủ nhật hiển thị là "Chủ nhật". Thứ được tính theo múi giờ VN nên không bị
 * lệch ngày khi server chạy UTC (VD họp 06:00 sáng VN vẫn là ngày hôm đó).
 */
export function formatLongDateVN(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VN_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayVN: Record<string, string> = {
    Mon: 'Thứ 2',
    Tue: 'Thứ 3',
    Wed: 'Thứ 4',
    Thu: 'Thứ 5',
    Fri: 'Thứ 6',
    Sat: 'Thứ 7',
    Sun: 'Chủ nhật'
  };
  return `${weekdayVN[get('weekday')] ?? ''}, ngày ${get('day')} tháng ${get('month')} năm ${get('year')}`;
}
