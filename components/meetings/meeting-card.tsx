import Link from 'next/link';
import type { Meeting } from '@/types/meeting';
import MeetingStatusBadge from './meeting-status-badge';
import { IconDotsVertical, IconStarFilled } from '@/components/ui/icons';

const typeLabel: Record<string, string> = {
  INTERNAL: 'Họp nội bộ',
  EXTERNAL: 'Họp ngoài ngành'
};

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = (x: Date) => x.toLocaleDateString('vi-VN');
  const t = (x: Date) => x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${d(s)} ${t(s)} - ${t(e)}` : `${d(s)} ${t(s)} - ${d(e)} ${t(e)}`;
}

/**
 * Thẻ cuộc họp dùng chung cho trang "Cuộc họp" và "Tìm kiếm" — bố cục khớp
 * với bản mẫu: tiêu đề + menu 3 chấm, đường kẻ ngăn, rồi các dòng
 * Trạng thái / Đơn vị / Địa điểm / Ngày họp / Loại.
 */
export default function MeetingCard({
  meeting,
  departmentName,
  showType = true,
  isRelevant = false
}: {
  meeting: Meeting;
  departmentName?: string | null;
  showType?: boolean;
  /** Cuộc họp liên quan đến phòng ban của người đang đăng nhập — hiển thị sao vàng. */
  isRelevant?: boolean;
}) {
  return (
    <Link href={`/meetings/${meeting.id}`} className="card block p-4 hover:border-gold/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {isRelevant && (
            <IconStarFilled
              size={16}
              className="text-gold flex-shrink-0 mt-0.5"
              aria-label="Cuộc họp liên quan đến phòng ban của bạn"
            />
          )}
          <h3 className="font-semibold leading-snug">{meeting.title}</h3>
        </div>
        {/* Chỉ mang tính hiển thị, khớp bản mẫu — thao tác nhanh (đổi/xoá) đã có sẵn trong trang chi tiết */}
        <IconDotsVertical size={18} className="text-inksoft flex-shrink-0 mt-0.5" aria-hidden />
      </div>

      <div className="border-t border-line my-3" />

      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-inksoft flex-shrink-0">Trạng thái:</dt>
          <dd>
            <MeetingStatusBadge meeting={meeting} />
          </dd>
        </div>
        {departmentName && (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-inksoft flex-shrink-0">Đơn vị:</dt>
            <dd className="font-medium">{departmentName}</dd>
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <dt className="text-inksoft flex-shrink-0">Địa điểm:</dt>
          <dd className="font-medium">{meeting.location || '— chưa xác định'}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-inksoft flex-shrink-0">Ngày họp:</dt>
          <dd className="font-medium">{fmtRange(meeting.start_at, meeting.end_at)}</dd>
        </div>
        {showType && (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-inksoft flex-shrink-0">Loại:</dt>
            <dd className="font-medium">{typeLabel[meeting.meeting_type] ?? meeting.meeting_type}</dd>
          </div>
        )}
      </dl>
    </Link>
  );
}
