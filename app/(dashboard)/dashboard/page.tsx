import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import { isMeetingRelevantToDepartment, sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import DashboardBanner from '@/components/dashboard/dashboard-banner';
import type { Meeting } from '@/types/meeting';
import { IconClock, IconCalendar } from '@/components/ui/icons';
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
  // Cuộc họp Ngoài ngành (EXTERNAL) không có khái niệm "liên quan theo phòng ban" —
  // chỉ liên quan tới ĐÚNG người được cử tham dự đích danh, HOẶC chính người đã
  // tạo ra cuộc họp đó, khớp đúng quy tắc canViewMeeting() ở lib/permissions/index.ts.
  const personalMeetingIds = new Set<string>();
  for (const row of (participants ?? []) as any[]) {
    const arr = participantDeptsByMeeting.get(row.meeting_id) ?? [];
    arr.push(row.profiles?.department_id ?? null);
    participantDeptsByMeeting.set(row.meeting_id, arr);
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
        <h2 className="font-semibold mb-2.5">Cuộc họp gần nhất</h2>

        {highlightList.length === 0 ? (
          <p className="table-empty card">Hiện không có cuộc họp nào đang/sắp diễn ra liên quan đến bạn.</p>
        ) : (
          <div className="space-y-3">
            {highlightList.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="card block p-4 hover:border-gold/40 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="icon-tile-peach flex-shrink-0">
                    <IconCalendar size={24} />
                  </div>
                  <h3 className="min-w-0 flex-1 font-display text-lg font-bold leading-snug text-ink">
                    {m.title}
                  </h3>
                </div>

                <div className="border-t border-line my-3.5" />

                <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-sm text-inksoft mb-3">
                  <span className="inline-flex items-center gap-1.5">
                    <IconCalendar size={16} className="flex-shrink-0" />
                    {formatDateVN(m.start_at)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconClock size={16} className="flex-shrink-0" />
                    {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <dt className="text-inksoft w-[76px] flex-shrink-0">Cuộc họp</dt>
                    <dd className="font-medium flex-1">
                      {m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : 'Nội bộ'}
                    </dd>
                  </div>
                  <div className="flex items-start gap-3">
                    <dt className="text-inksoft w-[76px] flex-shrink-0">Địa điểm</dt>
                    <dd className="font-medium flex-1">{m.location || '— chưa xác định'}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}

        <Link href="/meetings" className="inline-flex items-center gap-1 text-sm text-gold font-medium mt-3">
          Xem tất cả cuộc họp →
        </Link>
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
