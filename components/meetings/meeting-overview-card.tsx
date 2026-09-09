import type { MeetingOverviewRow } from '@/types/meeting';
import MeetingStatusBadge from './meeting-status-badge';
import { formatDateVN, formatTimeVN } from '@/lib/format-date';

const typeLabel: Record<string, string> = {
  INTERNAL: 'Họp nội bộ',
  EXTERNAL: 'Họp ngoài ngành'
};

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const d = (x: Date) => formatDateVN(x);
  const t = (x: Date) => formatTimeVN(x, { hour: '2-digit', minute: '2-digit' });
  const sameDay = d(s) === d(e);
  return sameDay ? `${d(s)} ${t(s)} - ${t(e)}` : `${d(s)} ${t(s)} - ${d(e)} ${t(e)}`;
}

/**
 * Thẻ CHỈ HIỂN THỊ thông tin cơ bản, dùng cho tab "Thông tin cuộc họp".
 * CỐ Ý không bọc <Link> và không có menu 3 chấm — người xem không được
 * gán quyền vào cuộc họp thì không có cách nào bấm vào xem chi tiết được,
 * kể cả khi biết trước id (trang chi tiết vẫn bị RLS chặn như bình thường).
 */
export default function MeetingOverviewCard({ meeting }: { meeting: MeetingOverviewRow }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold leading-snug">{meeting.title}</h3>
      {meeting.summary && <p className="text-sm text-inksoft mt-0.5">{meeting.summary}</p>}

      <div className="border-t border-line my-3" />

      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-inksoft flex-shrink-0">Trạng thái:</dt>
          <dd>
            <MeetingStatusBadge meeting={meeting} />
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-inksoft flex-shrink-0">Loại:</dt>
          <dd className="font-medium">{typeLabel[meeting.meeting_type] ?? meeting.meeting_type}</dd>
        </div>
        {meeting.host_department_name && (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-inksoft flex-shrink-0">Đơn vị:</dt>
            <dd className="font-medium">{meeting.host_department_name}</dd>
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
      </dl>
    </div>
  );
}
