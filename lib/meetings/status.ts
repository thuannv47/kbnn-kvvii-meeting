import type { Meeting } from '@/types/meeting';

export type MeetingDisplayStatus = 'DRAFT' | 'LIVE' | 'UPCOMING' | 'DONE';

export interface MeetingStatusInfo {
  key: MeetingDisplayStatus;
  label: string;
  dotColor: string | null;
  className: string;
}

const STATUS_INFO: Record<MeetingDisplayStatus, MeetingStatusInfo> = {
  DRAFT: { key: 'DRAFT', label: 'Nháp', dotColor: null, className: 'badge-draft' },
  LIVE: { key: 'LIVE', label: 'Đang diễn ra', dotColor: '#1E7A34', className: 'badge-live' },
  UPCOMING: { key: 'UPCOMING', label: 'Chưa diễn ra', dotColor: '#B7791F', className: 'badge-upcoming' },
  DONE: { key: 'DONE', label: 'Đã kết thúc', dotColor: '#6B7280', className: 'badge-done' }
};

/**
 * Tính trạng thái HIỂN THỊ của cuộc họp dựa trên thời gian thực tế (start_at / end_at),
 * KHÔNG chỉ dựa vào cột `status` lưu trong DB (vì một cuộc họp có status = OPEN vẫn có thể
 * chưa tới ngày họp, hoặc đã họp xong từ lâu).
 *
 * Quy tắc:
 * - status = DRAFT (nháp)                              -> luôn hiển thị "Nháp".
 * - now nằm trong khoảng [start_at, end_at]             -> "Đang diễn ra".
 * - start_at còn ở tương lai (chưa tới ngày)             -> "Sắp diễn ra".
 * - Còn lại (đã qua end_at)                              -> "Đã kết thúc".
 */
export function getMeetingDisplayStatus(
  meeting: Pick<Meeting, 'status' | 'start_at' | 'end_at'>,
  now: Date = new Date()
): MeetingStatusInfo {
  if (meeting.status === 'DRAFT') return STATUS_INFO.DRAFT;

  const start = new Date(meeting.start_at);
  const end = new Date(meeting.end_at);

  if (start <= now && now <= end) return STATUS_INFO.LIVE;
  if (start > now) return STATUS_INFO.UPCOMING;
  return STATUS_INFO.DONE;
}
