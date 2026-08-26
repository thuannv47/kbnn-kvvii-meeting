import Link from 'next/link';
import type { Meeting } from '@/types/meeting';
import MeetingStatusBadge from './meeting-status-badge';

export default function MeetingCard({
  meeting,
  departmentName,
  docCount
}: {
  meeting: Meeting;
  departmentName?: string;
  docCount?: number;
}) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="card block p-4 hover:-translate-y-0.5 hover:shadow-md hover:border-line transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <MeetingStatusBadge meeting={meeting} />
        <span className="font-mono text-xs text-inksoft">{meeting.code}</span>
      </div>
      <h3 className="text-base font-semibold mb-1 font-display">{meeting.title}</h3>
      <p className="text-sm text-inksoft mb-2">{departmentName}</p>
      <p className="text-xs text-inksoft mb-3">
        {new Date(meeting.start_at).toLocaleString('vi-VN')} →{' '}
        {new Date(meeting.end_at).toLocaleString('vi-VN')}
      </p>
      <div className="flex gap-4 text-xs text-inksoft">
        <span>📎 {docCount ?? 0} tài liệu</span>
      </div>
    </Link>
  );
}
