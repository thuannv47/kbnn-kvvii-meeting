import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import { isMeetingRelevantToDepartment, sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import DashboardBanner from '@/components/dashboard/dashboard-banner';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';
import type { Meeting } from '@/types/meeting';
import { IconCalendar, IconClock, IconSearch, IconBuilding, IconUser, IconUsers, IconShield } from '@/components/ui/icons';
import { formatDateVN, formatTimeVN } from '@/lib/format-date';

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
  // riêng cuộc sắp diễn ra như trước) — để tính "liên quan" cho cả mục
  // "Cuộc họp gần đây" (đã kết thúc) chứ không chỉ mục "sắp diễn ra".
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

  // Mục "Cuộc họp gần đây": đã kết thúc, mới nhất trước, tối đa 5 dòng.
  const recentList = sortMeetingsByStartThenTitle(
    relevantAll.filter((m) => getMeetingDisplayStatus(m, now).key === 'DONE'),
    'desc'
  ).slice(0, 5);

  // Thống kê nhanh trong THÁNG HIỆN TẠI (theo start_at) — dùng trạng thái thực tế
  // (đã kết thúc / sắp diễn ra) làm thước đo, vì hệ thống chưa có tính năng
  // xác nhận tham dự (điểm danh) riêng.
  const monthMeetings = relevantAll.filter((m) => {
    const d = new Date(m.start_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthDone = monthMeetings.filter((m) => getMeetingDisplayStatus(m, now).key === 'DONE').length;
  const monthUpcoming = monthMeetings.length - monthDone;

  const quickLinks = [
    { href: '/meetings/create', icon: IconCalendar, label: 'Tạo cuộc họp', desc: 'Lên lịch và mời thành viên tham dự', tile: 'icon-tile-rose' as const },
    { href: '/meetings', icon: IconUsers, label: 'Cuộc họp của tôi', desc: 'Xem danh sách các cuộc họp liên quan', tile: 'icon-tile-violet' as const },
    { href: '/search', icon: IconSearch, label: 'Tìm kiếm & Tài liệu', desc: 'Tìm cuộc họp, tài liệu đã chia sẻ', tile: 'icon-tile-peach' as const },
    { href: '/departments', icon: IconBuilding, label: 'Phòng ban', desc: 'Xem thông tin các phòng ban', tile: 'icon-tile-slate' as const },
    ...(canManageOrg(profile)
      ? [
          { href: '/users', icon: IconUsers, label: 'Người dùng', desc: 'Quản lý tài khoản người dùng', tile: 'icon-tile-amber' as const },
          { href: '/admin', icon: IconShield, label: 'Quản trị / Audit', desc: 'Theo dõi nhật ký hệ thống', tile: 'icon-tile-indigo' as const }
        ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <DashboardBanner profile={profile} departmentName={dept?.name} />

      {/* Lưới truy cập nhanh — card lớn có mô tả, khớp bản mẫu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickLinks.map(({ href, icon: Icon, label, desc, tile }) => (
          <Link key={label} href={href} className="card flex items-center gap-3.5 p-4 hover:border-gold/40 transition-colors">
            <span className={tile}>
              <Icon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs text-inksoft mt-0.5 leading-snug">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Cột chính */}
        <div className="space-y-6 min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-semibold">Cuộc họp sắp diễn ra</h2>
              <Link href="/meetings" className="text-sm text-gold font-medium">
                Xem tất cả →
              </Link>
            </div>

            {highlightList.length === 0 ? (
              <p className="table-empty card">Hiện không có cuộc họp nào đang/sắp diễn ra liên quan đến bạn.</p>
            ) : (
              <div className="space-y-3">
                {highlightList.map((m) => {
                  const d = new Date(m.start_at);
                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="card flex items-stretch gap-3.5 p-3.5 hover:border-gold/40 transition-colors"
                    >
                      <div className="icon-tile-rose flex-col leading-none flex-shrink-0">
                        <span className="text-[10px] font-semibold uppercase -mb-0.5">
                          Th{String(d.getMonth() + 1).padStart(2, '0')}
                        </span>
                        <span className="text-lg font-bold">{d.getDate()}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-snug text-sm truncate">{m.title}</h3>
                          <span className="flex-shrink-0">
                            <MeetingStatusBadge meeting={m} now={now} />
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-inksoft">
                          <IconClock size={13} className="flex-shrink-0" />
                          {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                          <span className="w-[3px] h-[3px] rounded-full bg-line mx-0.5 flex-shrink-0" />
                          {m.location || (m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : 'Nội bộ')}
                        </div>
                        {m.meeting_type === 'EXTERNAL' && (
                          <div className="text-xs text-inksoft mt-1">
                            {participantCountByMeeting.get(m.id) ?? 0} người được cử đi
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-semibold">Cuộc họp gần đây</h2>
              <Link href="/search" className="text-sm text-gold font-medium">
                Xem tất cả →
              </Link>
            </div>
            {recentList.length === 0 ? (
              <p className="table-empty card">Chưa có cuộc họp nào đã kết thúc.</p>
            ) : (
              <div className="table-wrap">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Tên cuộc họp</th>
                      <th className="hidden sm:table-cell">Trạng thái</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {recentList.map((m) => (
                      <tr key={m.id} className="row-click">
                        <td className="whitespace-nowrap text-inksoft">
                          {formatDateVN(m.start_at)} {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="font-medium max-w-[240px] truncate">{m.title}</td>
                        <td className="hidden sm:table-cell">
                          <MeetingStatusBadge meeting={m} now={now} />
                        </td>
                        <td className="text-right">
                          <Link href={`/meetings/${m.id}`} className="text-gold font-medium">
                            Xem
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Cột phụ — thống kê */}
        <div className="space-y-4">
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
      </div>
    </div>
  );
}
