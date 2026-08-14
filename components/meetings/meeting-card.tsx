import Link from 'next/link';
import type { Meeting } from '@/types/meeting';

const statusLabel: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-line text-inksoft' },
  OPEN: { label: 'Đang diễn ra', className: 'bg-green text-white' },
  CLOSED: { label: 'Đã kết thúc', className: 'bg-ink text-white' },
  ARCHIVED: { label: 'Lưu trữ', className: 'bg-inksoft text-white' }
};

export default function MeetingCard({
  meeting,
  departmentName,
  docCount,
  commentCount
}: {
  meeting: Meeting;
  departmentName?: string;
  docCount?: number;
  commentCount?: number;
}) {
  const st = statusLabel[meeting.status] ?? statusLabel.DRAFT;
  return (
    <Link href={`/meetings/${meeting.id}`} className="card block p-4 hover:border-gold transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`badge ${st.className}`}>{st.label}</span>
        <span className="font-mono text-xs text-inksoft">{meeting.code}</span>
      </div>
      <h3 className="text-base font-semibold mb-1">{meeting.title}</h3>
      <p className="text-sm text-inksoft mb-2">{departmentName}</p>
      <p className="text-xs text-inksoft mb-3">
        {new Date(meeting.start_at).toLocaleString('vi-VN')} →{' '}
        {new Date(meeting.end_at).toLocaleString('vi-VN')}
      </p>
      <div className="flex gap-4 text-xs text-inksoft">
        <span>📎 {docCount ?? 0} tài liệu</span>
        <span>💬 {commentCount ?? 0} ý kiến</span>
      </div>
    </Link>
  );
}
