import Link from 'next/link';
import type { Meeting } from '@/types/meeting';
import MeetingStatusBadge from './meeting-status-badge';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';

// Màu vạch nhấn bên trái card, khớp với trạng thái hiển thị của cuộc họp
const ACCENT_BY_STATUS: Record<string, string> = {
  LIVE: 'bg-red',
  UPCOMING: 'bg-green',
  DONE: 'bg-slate',
  DRAFT: 'bg-line'
};

export default function MeetingCard({
  meeting,
  departmentName,
  docCount
}: {
  meeting: Meeting;
  departmentName?: string;
  docCount?: number;
}) {
  const status = getMeetingDisplayStatus(meeting);

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group relative block rounded-xl2 border border-line bg-surface p-4 pl-[18px] shadow-card transition-all hover:-translate-y-0.5 hover:border-[#D8D4C1] hover:shadow-card-lift"
    >
      <span
        aria-hidden
        className={`absolute bottom-2.5 left-0 top-2.5 w-[3.5px] rounded-full ${ACCENT_BY_STATUS[status.key]}`}
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <MeetingStatusBadge meeting={meeting} />
        <span className="font-mono text-[10px] text-inksoft">{meeting.code}</span>
      </div>

      <h3 className="mb-1 font-display text-[14.5px] font-semibold leading-snug text-ink">
        {meeting.title}
      </h3>
      {departmentName && (
        <p className="mb-2 text-[11.5px] font-semibold text-gold">{departmentName}</p>
      )}
      <p className="mb-2.5 text-[11px] text-inksoft">
        🕘 {new Date(meeting.start_at).toLocaleString('vi-VN')} →{' '}
        {new Date(meeting.end_at).toLocaleString('vi-VN')}
      </p>

      <div className="mb-2.5 h-px bg-line" />

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-paper2 px-2.5 py-1 text-[10.5px] text-inksoft">
          📎 {docCount ?? 0} tài liệu
        </span>
      </div>
    </Link>
  );
}
