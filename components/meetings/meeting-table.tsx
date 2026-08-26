import Link from 'next/link';
import type { Meeting } from '@/types/meeting';
import MeetingStatusBadge from './meeting-status-badge';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';

type Row = Meeting & { departments?: { name: string } };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN');
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Thứ tự ưu tiên hiển thị khi gộp chung 1 bảng: Nháp cần xử lý nên đưa lên đầu,
// rồi đang diễn ra, rồi sắp diễn ra, rồi vừa kết thúc.
const STATUS_ORDER: Record<string, number> = { DRAFT: 0, LIVE: 1, UPCOMING: 2, DONE: 3 };
const ROW_ACCENT: Record<string, string> = {
  LIVE: 'before:bg-red',
  UPCOMING: 'before:bg-green',
  DONE: 'before:bg-slate',
  DRAFT: 'before:bg-line'
};

export default function MeetingTable({
  items,
  docCountByMeeting,
  deptCountByMeeting,
  empty = 'Không có cuộc họp nào.',
<<<<<<< HEAD
  now,
  flat = false
=======
  now
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
}: {
  items: Row[];
  docCountByMeeting: Record<string, number>;
  deptCountByMeeting?: Record<string, number>;
  empty?: string;
  now?: Date;
<<<<<<< HEAD
  /** Khi lồng trong 1 card khác (VD trang chủ) — bỏ khung/bo góc riêng và vạch màu bên trái
   *  để tránh viền lồng viền; trạng thái vẫn được truyền đạt qua badge. */
  flat?: boolean;
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
}) {
  const sorted = [...items].sort((a, b) => {
    const sa = getMeetingDisplayStatus(a, now).key;
    const sb = getMeetingDisplayStatus(b, now).key;
    if (STATUS_ORDER[sa] !== STATUS_ORDER[sb]) return STATUS_ORDER[sa] - STATUS_ORDER[sb];
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  });

<<<<<<< HEAD
  const wrapClass = flat ? 'overflow-x-auto' : 'table-wrap';

  if (sorted.length === 0) {
    return (
      <div className={wrapClass}>
=======
  if (sorted.length === 0) {
    return (
      <div className="table-wrap">
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
        <p className="table-empty">{empty}</p>
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className={wrapClass}>
=======
    <div className="table-wrap">
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
      <table className="table-clean">
        <thead>
          <tr>
            <th className="w-[100px]">Thời gian</th>
            <th>Cuộc họp</th>
<<<<<<< HEAD
            <th className="hidden md:table-cell">Địa điểm</th>
=======
            <th className="hidden md:table-cell w-[190px]">Phòng chủ trì</th>
            <th className="hidden md:table-cell w-[110px]">Phòng tham gia</th>
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
            <th className="w-[80px] text-right">Tài liệu</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const status = getMeetingDisplayStatus(m, now).key;
            const deptCount = deptCountByMeeting?.[m.id] ?? 0;
            return (
              <tr
                key={m.id}
<<<<<<< HEAD
                className={
                  flat
                    ? 'row-click'
                    : `row-click relative pl-1 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-full ${ROW_ACCENT[status]}`
                }
              >
                <td className="align-top">
                  <Link href={`/meetings/${m.id}`} className={flat ? 'block' : 'block pl-2'}>
=======
                className={`row-click relative pl-1 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-full ${ROW_ACCENT[status]}`}
              >
                <td className="align-top">
                  <Link href={`/meetings/${m.id}`} className="block pl-2">
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
                    {/* Ngày họp + khoảng thời gian bắt đầu → kết thúc */}
                    <div className="font-mono text-xs font-semibold text-ink">{fmtDate(m.start_at)}</div>
                    <div className="font-mono text-[11px] text-inksoft whitespace-nowrap">
                      {fmtTime(m.start_at)}–{fmtTime(m.end_at)}
                    </div>
                  </Link>
                </td>
                <td className="align-top">
                  <Link href={`/meetings/${m.id}`} className="block">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[10px] text-gold">{m.code}</span>
                      <MeetingStatusBadge meeting={m} now={now} />
<<<<<<< HEAD
                      {m.meeting_type === 'EXTERNAL' && (
                        <span className="badge bg-gold/15 text-gold">Ngoài ngành</span>
                      )}
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
                    </div>
                    <div className="font-semibold leading-snug">{m.title}</div>
                    {/* Trên mobile: gộp phòng chủ trì + số phòng tham gia xuống dưới tiêu đề,
                        vì 2 cột riêng bị ẩn ở màn hình nhỏ. */}
                    <div className="md:hidden text-xs text-inksoft mt-0.5 flex items-center gap-2 flex-wrap">
                      {m.departments?.name && <span>🏢 {m.departments.name}</span>}
<<<<<<< HEAD
                      {m.location && <span>📍 {m.location}</span>}
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
                      {deptCount > 0 && <span>👥 {deptCount} phòng tham gia</span>}
                    </div>
                  </Link>
                </td>
<<<<<<< HEAD
                <td className="hidden md:table-cell align-top text-inksoft font-semibold">
                  {m.location ? (
                    <span className="inline-flex items-start gap-1.5">
                      <span aria-hidden>📍</span>
                      <span>{m.location}</span>
                    </span>
                  ) : (
                    <span className="text-line font-normal">—</span>
=======
                <td className="hidden md:table-cell align-top text-inksoft">
                  <span className="inline-flex items-start gap-1.5">
                    <span aria-hidden>🏢</span>
                    <span>{m.departments?.name ?? '—'}</span>
                  </span>
                </td>
                <td className="hidden md:table-cell align-top text-inksoft whitespace-nowrap">
                  {deptCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>👥</span>
                      {deptCount} phòng
                    </span>
                  ) : (
                    <span className="text-line">—</span>
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
                  )}
                </td>
                <td className="align-top text-right text-inksoft whitespace-nowrap">
                  📎 {docCountByMeeting[m.id] ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
