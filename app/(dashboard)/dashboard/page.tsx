import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import { isMeetingRelevantToDepartment, sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import DashboardBanner from '@/components/dashboard/dashboard-banner';
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

  // QUY TẮC HIỂN THỊ TRÊN DASHBOARD (mục "Cuộc họp gần nhất"):
  //  1) Chỉ lấy cuộc họp LIÊN QUAN đến phòng ban của người dùng — cuộc họp khác
  //     xem trong "Danh sách các cuộc họp".
  //  2) Lấy cả cuộc họp ĐANG diễn ra (LIVE) lẫn SẮP diễn ra (UPCOMING) — cuộc ĐÃ
  //     kết thúc xem trong "Danh sách các cuộc họp".
  //  3) Sắp xếp: Đang diễn ra lên trước, trong mỗi nhóm theo Ngày - giờ bắt đầu
  //     (sớm nhất trước); trùng giờ thì theo Tên hội nghị A -> Z.
  const relevantStatuses = new Set(['LIVE', 'UPCOMING']);
  const upcoming = list.filter((m) => relevantStatuses.has(getMeetingDisplayStatus(m, now).key));

  const upcomingIds = upcoming.map((m) => m.id);
  const [{ data: meetingDepartments }, { data: participants }] = upcomingIds.length
    ? await Promise.all([
        supabase.from('meeting_departments').select('meeting_id, department_id, can_view').in('meeting_id', upcomingIds),
        supabase
          .from('meeting_participants')
          .select('meeting_id, user_id, profiles:user_id(department_id)')
          .in('meeting_id', upcomingIds)
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
  // tạo ra cuộc họp đó (VD: lãnh đạo nhận giấy mời rồi tạo cuộc họp để tag người
  // khác đi thay — bản thân người tạo không tự tag mình nhưng vẫn phải thấy được
  // trên Dashboard, khớp đúng quy tắc canViewMeeting() ở lib/permissions/index.ts).
  // Gom riêng ra 1 tập meeting_id mà chính người dùng hiện tại có tên trong
  // meeting_participants.
  const personalMeetingIds = new Set<string>();
  for (const row of (participants ?? []) as any[]) {
    const arr = participantDeptsByMeeting.get(row.meeting_id) ?? [];
    arr.push(row.profiles?.department_id ?? null);
    participantDeptsByMeeting.set(row.meeting_id, arr);
    participantCountByMeeting.set(row.meeting_id, (participantCountByMeeting.get(row.meeting_id) ?? 0) + 1);
    if (row.user_id === profile.id) personalMeetingIds.add(row.meeting_id);
  }

  const relevantUpcoming = upcoming.filter((m) => {
    if (m.meeting_type === 'EXTERNAL') {
      return personalMeetingIds.has(m.id) || m.created_by === profile.id;
    }
    return isMeetingRelevantToDepartment(m, profile.department_id, {
      meetingDepartments: deptPermsByMeeting.get(m.id) ?? [],
      participantDepartmentIds: participantDeptsByMeeting.get(m.id) ?? []
    });
  });

  const highlightList = (() => {
    const byTime = sortMeetingsByStartThenTitle(relevantUpcoming, 'asc');
    const STATUS_ORDER: Record<string, number> = { LIVE: 0, UPCOMING: 1 };
    return [...byTime].sort(
      (a, b) => STATUS_ORDER[getMeetingDisplayStatus(a, now).key] - STATUS_ORDER[getMeetingDisplayStatus(b, now).key]
    );
  })();

  const quickLinks = [
    { href: '/meetings', icon: IconCalendar, label: 'Cuộc họp', tile: 'icon-tile-peach' as const },
    { href: '/search', icon: IconSearch, label: 'Tìm kiếm', tile: 'icon-tile-violet' as const },
    { href: '/departments', icon: IconBuilding, label: 'Phòng ban', tile: 'icon-tile-rose' as const },
    { href: '/account', icon: IconUser, label: 'Tài khoản', tile: 'icon-tile-slate' as const },
    ...(canManageOrg(profile)
      ? [
          { href: '/users', icon: IconUsers, label: 'Người dùng', tile: 'icon-tile-amber' as const },
          { href: '/admin', icon: IconShield, label: 'Quản trị / Audit', tile: 'icon-tile-indigo' as const }
        ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <DashboardBanner profile={profile} departmentName={dept?.name} />

      <div className="hidden md:block">
        <h1 className="text-2xl">Trang chủ</h1>
      </div>

      {/* Lưới truy cập nhanh — khớp bố cục bản mẫu (4 icon/hàng) */}
      <div className="grid grid-cols-4 gap-4">
        {quickLinks.map(({ href, icon: Icon, label, tile }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-2 text-center">
            <span className={tile}>
              <Icon size={24} />
            </span>
            <span className="text-[11.5px] leading-tight text-ink">{label}</span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="font-semibold mb-2.5">Cuộc họp gần nhất</h2>

        {highlightList.length === 0 ? (
          <p className="table-empty card">Hiện không có cuộc họp nào đang/sắp diễn ra liên quan đến phòng ban của bạn.</p>
        ) : (
          <div className="space-y-3">
            {highlightList.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="card block p-4 hover:border-gold/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="icon-tile-peach flex-shrink-0">
                    <IconCalendar size={22} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">{m.title}</h3>
                    {m.summary && <p className="text-sm text-inksoft mt-0.5">{m.summary}</p>}
                  </div>
                </div>

                <div className="border-t border-line my-3" />

                <div className="text-sm">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <IconCalendar size={15} className="text-inksoft flex-shrink-0" />
                    <span className="font-medium">{formatDateVN(m.start_at)}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-line mx-0.5 flex-shrink-0" />
                    <IconClock size={15} className="text-inksoft flex-shrink-0" />
                    <span className="font-medium">
                      {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <span className="text-inksoft flex-shrink-0 w-[92px]">Cuộc họp</span>
                      <span className="font-medium">
                        {m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : 'Nội bộ'}
                      </span>
                    </div>
                    {m.meeting_type === 'EXTERNAL' ? (
                      <>
                        <div className="flex gap-2">
                          <span className="text-inksoft flex-shrink-0 w-[92px]">Địa điểm</span>
                          <span className="font-medium">{m.location || '— chưa xác định'}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-inksoft flex-shrink-0 w-[92px]">Được cử đi</span>
                          <span className="font-medium">
                            {participantCountByMeeting.get(m.id) ?? 0} người
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <span className="text-inksoft flex-shrink-0 w-[92px]">Địa điểm</span>
                        <span className="font-medium">{m.location || '— chưa xác định'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Link href="/meetings" className="inline-block mt-3 text-sm text-gold font-medium">
          Xem tất cả cuộc họp →
        </Link>
      </div>
    </div>
  );
}
