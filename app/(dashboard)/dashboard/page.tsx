import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import { isMeetingRelevantToDepartment, sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import DashboardBanner from '@/components/dashboard/dashboard-banner';
import type { Meeting } from '@/types/meeting';
import { IconClock, IconPin, IconUsers, IconCalendarDays, IconCheck } from '@/components/ui/icons';
import { formatTimeVN, formatDateVN } from '@/lib/format-date';

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: dept } = await supabase
    .from('departments')
    .select('name')
    .eq('id', profile.department_id)
    .maybeSingle();

  // Dashboard: chỉ xét cuộc họp còn trong thời gian hiển thị (visible_until).
  // RLS đã tự lọc theo quyền xem, ở đây chỉ lọc thêm điều kiện visible_until cho Dashboard.
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso);
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .or(`visible_until.is.null,visible_until.gte.${nowIso}`);

  const list = (meetings ?? []) as Meeting[];
  const allIds = list.map((m) => m.id);

  // Lấy phân quyền phòng ban + người được tag cho TOÀN BỘ danh sách (không chỉ
  // riêng cuộc sắp diễn ra như trước) — để tính "liên quan" và số lượng người
  // tham dự cho cả mục "Cuộc họp gần đây" (đã kết thúc), không chỉ mục "sắp diễn ra".
  const [{ data: meetingDepartments }, { data: participants }] = allIds.length
    ? await Promise.all([
        supabase.from('meeting_departments').select('meeting_id, department_id, can_view').in('meeting_id', allIds),
        supabase
          .from('meeting_participants')
          .select('meeting_id, user_id, profiles:user_id(department_id)')
          .in('meeting_id', allIds)
      ])
    : [{ data: [] }, { data: [] }];

  const deptPermsByMeeting = new Map<string, { department_id: string; can_view: boolean }[]>();
  for (const row of meetingDepartments ?? []) {
    const arr = deptPermsByMeeting.get(row.meeting_id) ?? [];
    arr.push({ department_id: row.department_id, can_view: row.can_view });
    deptPermsByMeeting.set(row.meeting_id, arr);
  }
  const participantDeptsByMeeting = new Map<string, (string | null | undefined)[]>();
  const participantCountByMeeting = new Map<string, number>();
  // Cuộc họp Ngoài ngành (EXTERNAL) không có khái niệm "liên quan theo phòng ban" —
  // chỉ liên quan tới ĐÚNG người được cử tham dự đích danh, HOẶC chính người đã
  // tạo ra cuộc họp đó, khớp đúng quy tắc canViewMeeting() ở lib/permissions/index.ts.
  const personalMeetingIds = new Set<string>();
  for (const row of (participants ?? []) as any[]) {
    const arr = participantDeptsByMeeting.get(row.meeting_id) ?? [];
    arr.push(row.profiles?.department_id ?? null);
    participantDeptsByMeeting.set(row.meeting_id, arr);
    participantCountByMeeting.set(row.meeting_id, (participantCountByMeeting.get(row.meeting_id) ?? 0) + 1);
    if (row.user_id === profile.id) personalMeetingIds.add(row.meeting_id);
  }

  function isRelevant(m: Meeting) {
    if (m.meeting_type === 'EXTERNAL') {
      return personalMeetingIds.has(m.id) || m.created_by === profile.id;
    }
    return isMeetingRelevantToDepartment(m, profile.department_id, {
      meetingDepartments: deptPermsByMeeting.get(m.id) ?? [],
      participantDepartmentIds: participantDeptsByMeeting.get(m.id) ?? []
    });
  }

  const relevantAll = list.filter(isRelevant);

  // Mục "Cuộc họp sắp diễn ra": đang diễn ra (LIVE) lên trước, rồi sắp diễn ra (UPCOMING).
  const highlightList = (() => {
    const upcoming = relevantAll.filter((m) => new Set(['LIVE', 'UPCOMING']).has(getMeetingDisplayStatus(m, now).key));
    const byTime = sortMeetingsByStartThenTitle(upcoming, 'asc');
    const STATUS_ORDER: Record<string, number> = { LIVE: 0, UPCOMING: 1 };
    return [...byTime].sort(
      (a, b) => STATUS_ORDER[getMeetingDisplayStatus(a, now).key] - STATUS_ORDER[getMeetingDisplayStatus(b, now).key]
    );
  })();

  // Thống kê nhanh trong THÁNG HIỆN TẠI (theo start_at) — TÍNH RIÊNG bằng 1 query
  // khác, KHÔNG dùng relevantAll và KHÔNG áp điều kiện visible_until, để khớp
  // đúng với những gì người dùng thấy ở trang "Tìm kiếm lịch sử" (chỉ giới hạn
  // bởi RLS, không lọc thêm theo phòng ban "liên quan" hay theo thời gian hiển
  // thị sau kết thúc). Trước đây dùng relevantAll + list đã lọc visible_until nên
  // 2 lỗi cộng lại làm số liệu bị đếm thiếu:
  //  1) Cuộc đã kết thúc quá lâu (hết hạn visible_until) biến mất khỏi `list`.
  //  2) Cuộc không "liên quan theo phòng ban" (vd. do phòng khác chủ trì nhưng
  //     người dùng vẫn xem được nhờ quyền rộng hơn/RLS) bị `relevantAll` loại bỏ.
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEndIso = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const { data: monthMeetingsRaw } = await supabase
    .from('meetings')
    .select('id, status, start_at, end_at')
    .gte('start_at', monthStartIso)
    .lt('start_at', monthEndIso);
  const monthMeetings = (monthMeetingsRaw ?? []) as Pick<Meeting, 'id' | 'status' | 'start_at' | 'end_at'>[];
  const monthDone = monthMeetings.filter((m) => getMeetingDisplayStatus(m, now).key === 'DONE').length;
  const monthUpcoming = monthMeetings.length - monthDone;

  // "Cuộc họp gần đây": các cuộc đã kết thúc, MỚI NHẤT lên trước — dùng relevantAll
  // (đã lọc theo phòng ban/người liên quan + còn trong visible_until) để khớp đúng
  // với những gì người dùng thấy ở mục "Cuộc họp sắp diễn ra" phía trên, chỉ khác
  // điều kiện lọc trạng thái.
  const recentDone = relevantAll
    .filter((m) => getMeetingDisplayStatus(m, now).key === 'DONE')
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <DashboardBanner profile={profile} departmentName={dept?.name} relatedMeetingCount={highlightList.length} />

      <div className="hidden md:block">
        <h1 className="text-2xl">Trang chủ</h1>
      </div>

      {/* ---- 1. Cuộc họp sắp diễn ra: danh sách cuộn DỌC bên trong 1 khung thẻ cố
          định chiều cao, thay cho carousel vuốt ngang trước đây — khớp theo ảnh
          mẫu bạn gửi. ---- */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconCalendarDays size={18} className="text-gold flex-shrink-0" />
            <h2 className="font-semibold">Cuộc họp sắp diễn ra</h2>
          </div>
          <Link href="/meetings" className="text-sm text-gold font-medium flex-shrink-0">
            Xem tất cả →
          </Link>
        </div>

        {highlightList.length === 0 ? (
          <p className="table-empty">Hiện không có cuộc họp nào đang/sắp diễn ra liên quan đến bạn.</p>
        ) : (
          <div className="max-h-[340px] overflow-y-auto -mx-1 divide-y divide-line scroll-thin pr-1">
            {highlightList.map((m) => {
              const d = new Date(m.start_at);
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="flex items-start gap-3 py-3 px-1 hover:bg-paper/70 transition-colors"
                >
                  <div className="icon-tile-peach w-12 h-12 flex-col leading-none flex-shrink-0">
                    <span className="text-base font-bold">{d.getDate()}</span>
                    <span className="text-[9px] font-bold uppercase -mt-0.5">
                      Th{String(d.getMonth() + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12.5px] text-inksoft">
                      <IconClock size={13} className="flex-shrink-0" />
                      {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <h3 className="font-display font-bold text-[14.5px] leading-snug text-ink mt-0.5 truncate">
                      {m.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-inksoft mt-1 min-w-0">
                      <IconPin size={13} className="flex-shrink-0" />
                      <span className="truncate">
                        {m.location || (m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : 'Nội bộ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-inksoft mt-1">
                      <IconUsers size={13} className="flex-shrink-0" />
                      {participantCountByMeeting.get(m.id) ?? 0} người tham dự
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- 2. Thống kê trong tháng: giữ nguyên 3 số liệu THẬT đã có sẵn (Tổng số /
          Đã kết thúc / Sắp diễn ra) — không đổi thành "Đã tham gia / Chưa tham gia"
          như ảnh mẫu vì hệ thống hiện CHƯA có cơ chế điểm danh/xác nhận tham dự để
          tính đúng 2 số đó; chỉ đổi cách trình bày sang icon tròn cho giống ảnh. ---- */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-4">Thống kê cuộc họp trong tháng</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-[#FDECE0] text-[#C2622A] flex items-center justify-center flex-shrink-0">
              <IconCalendarDays size={18} />
            </span>
            <div>
              <div className="text-lg font-bold text-ink">{monthMeetings.length}</div>
              <div className="text-[10.5px] text-inksoft leading-tight">Tổng số cuộc họp</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-[#E6F4EA] text-[#1E7A34] flex items-center justify-center flex-shrink-0">
              <IconCheck size={18} />
            </span>
            <div>
              <div className="text-lg font-bold text-[#1E7A34]">{monthDone}</div>
              <div className="text-[10.5px] text-inksoft leading-tight">Đã kết thúc</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-[#FDF1DC] text-[#8A5A17] flex items-center justify-center flex-shrink-0">
              <IconClock size={18} />
            </span>
            <div>
              <div className="text-lg font-bold text-gold">{monthUpcoming}</div>
              <div className="text-[10.5px] text-inksoft leading-tight">Sắp diễn ra</div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- 3. Cuộc họp gần đây: bảng mới, chưa có trong bản trước — các cuộc đã
          kết thúc gần nhất, mới nhất lên trước. ---- */}
      <div className="card p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconClock size={18} className="text-gold flex-shrink-0" />
            <h2 className="font-semibold">Cuộc họp gần đây</h2>
          </div>
          <Link href="/meetings" className="text-sm text-gold font-medium flex-shrink-0">
            Xem tất cả →
          </Link>
        </div>

        {recentDone.length === 0 ? (
          <p className="table-empty">Chưa có cuộc họp nào kết thúc gần đây.</p>
        ) : (
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[11.5px] text-inksoft border-b border-line">
                <th className="font-medium py-2 pr-3 whitespace-nowrap">Thời gian</th>
                <th className="font-medium py-2 pr-3">Tên cuộc họp</th>
                <th className="font-medium py-2 pr-3 whitespace-nowrap">Phòng họp</th>
                <th className="font-medium py-2 whitespace-nowrap">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentDone.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-inksoft text-[13px]">
                    {formatDateVN(m.start_at)} {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-ink max-w-[220px] truncate">
                    <Link href={`/meetings/${m.id}`} className="hover:text-gold">
                      {m.title}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-inksoft text-[13px] whitespace-nowrap">{m.location || '—'}</td>
                  <td className="py-2.5 whitespace-nowrap">
                    <span className="badge-done">Đã kết thúc</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
