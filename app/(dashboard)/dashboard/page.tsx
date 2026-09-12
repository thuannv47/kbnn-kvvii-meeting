import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import { isMeetingRelevantToDepartment, sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import DashboardBanner from '@/components/dashboard/dashboard-banner';
import type { Meeting } from '@/types/meeting';
import { IconClock, IconUsers, IconPin } from '@/components/ui/icons';
import { formatTimeVN } from '@/lib/format-date';

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

  return (
    <div className="space-y-6">
      <DashboardBanner profile={profile} departmentName={dept?.name} relatedMeetingCount={highlightList.length} />

      <div className="hidden md:block">
        <h1 className="text-2xl">Trang chủ</h1>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-semibold">Cuộc họp gần nhất</h2>
          <Link href="/meetings" className="text-sm text-gold font-medium">
            Xem tất cả →
          </Link>
        </div>

        {highlightList.length === 0 ? (
          <p className="table-empty card">Hiện không có cuộc họp nào đang/sắp diễn ra liên quan đến bạn.</p>
        ) : (
          <>
            <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pt-4 pb-1">
              {highlightList.map((m, idx) => {
                const d = new Date(m.start_at);
                return (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="relative card p-5 hover:border-gold/40 transition-colors w-full flex-shrink-0 snap-center"
                  >
                    <span className="absolute -top-3 left-3 z-10 flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500 text-white text-sm font-bold shadow-sm ring-2 ring-white">
                      {idx + 1}
                    </span>

                    <div className="flex items-start gap-4">
                      <div className="icon-tile-rose w-16 h-16 flex-col leading-none flex-shrink-0">
                        <span className="text-3xl font-bold">{d.getDate()}</span>
                        <span className="text-xs font-bold uppercase mt-0.5">
                          Th{String(d.getMonth() + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="min-w-0 flex-1 font-display text-xl font-bold leading-snug text-ink">
                        {m.title}
                      </h3>
                    </div>

                    <div className="border-t border-line my-4" />

                    <div className="space-y-3 text-base">
                      <div className="flex items-center gap-2.5">
                        <IconClock size={20} className="flex-shrink-0 text-inksoft" />
                        <span className="font-medium">
                          {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-start gap-2.5 min-w-0">
                        <IconPin size={20} className="flex-shrink-0 text-inksoft mt-0.5" />
                        <span className="font-medium break-words">
                          {m.location || (m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : 'Nội bộ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <IconUsers size={20} className="flex-shrink-0 text-inksoft" />
                        <span className="font-medium">
                          {participantCountByMeeting.get(m.id) ?? 0} người tham dự
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {highlightList.length > 1 && (
              <p className="text-[11px] text-inksoft text-center mt-2">
                ← Vuốt để xem thêm cuộc họp → ({highlightList.length} cuộc họp)
              </p>
            )}
          </>
        )}
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3">Thống kê cuộc họp trong tháng</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xl font-bold text-ink">{monthMeetings.length}</div>
            <div className="text-[10.5px] text-inksoft mt-0.5 leading-tight">Tổng số cuộc họp</div>
          </div>
          <div>
            <div className="text-xl font-bold text-[#1E7A34]">{monthDone}</div>
            <div className="text-[10.5px] text-inksoft mt-0.5 leading-tight">Đã kết thúc</div>
          </div>
          <div>
            <div className="text-xl font-bold text-gold">{monthUpcoming}</div>
            <div className="text-[10.5px] text-inksoft mt-0.5 leading-tight">Sắp diễn ra</div>
          </div>
        </div>
      </div>
    </div>
  );
}
