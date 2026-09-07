import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canCreateMeeting } from '@/lib/permissions';
import { isMeetingRelevantToDepartment, sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import type { Meeting, MeetingType } from '@/types/meeting';
import PageHeader from '@/components/dashboard/page-header';
import MeetingCard from '@/components/meetings/meeting-card';
import { IconSort, IconSearch, IconFilter, IconPlus } from '@/components/ui/icons';

type Row = Meeting & { departments?: { name: string } };

const TABS: { type: MeetingType; label: string }[] = [
  { type: 'INTERNAL', label: 'Họp nội bộ' },
  { type: 'EXTERNAL', label: 'Họp ngoài ngành' }
];

export default async function MeetingsListPage({
  searchParams
}: {
  searchParams: { type?: string; q?: string; sort?: 'asc' | 'desc' };
}) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const activeType: MeetingType = searchParams.type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
  // Mặc định xếp CŨ -> MỚI (đến trước ở dòng trên) theo đúng quy tắc hiển thị chuẩn;
  // người dùng vẫn có thể bấm đổi sang MỚI -> CŨ bằng nút sắp xếp.
  const sort = searchParams.sort === 'desc' ? 'desc' : 'asc';
  const q = searchParams.q?.trim() ?? '';

  // Lấy toàn bộ (RLS đã lọc theo quyền xem) để đếm số lượng từng loại cho 2 tab,
  // rồi mới lọc theo tab + từ khoá đang chọn để hiển thị danh sách.
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)');

  const all = (meetings ?? []) as Row[];
  const counts: Record<MeetingType, number> = {
    INTERNAL: all.filter((m) => m.meeting_type === 'INTERNAL').length,
    EXTERNAL: all.filter((m) => m.meeting_type === 'EXTERNAL').length
  };

  // Để đánh dấu SAO VÀNG (cuộc họp liên quan đến phòng ban của người dùng), cần biết:
  //  - phân quyền phòng ban (meeting_departments)
  //  - phòng ban của từng người được tag tham dự (meeting_participants -> profiles.department_id)
  const meetingIds = all.map((m) => m.id);
  const [{ data: meetingDepartments }, { data: participants }] = meetingIds.length
    ? await Promise.all([
        supabase.from('meeting_departments').select('meeting_id, department_id, can_view').in('meeting_id', meetingIds),
        supabase
          .from('meeting_participants')
          .select('meeting_id, profiles:user_id(department_id)')
          .in('meeting_id', meetingIds)
      ])
    : [{ data: [] }, { data: [] }];

  const deptPermsByMeeting = new Map<string, { department_id: string; can_view: boolean }[]>();
  for (const row of meetingDepartments ?? []) {
    const arr = deptPermsByMeeting.get(row.meeting_id) ?? [];
    arr.push({ department_id: row.department_id, can_view: row.can_view });
    deptPermsByMeeting.set(row.meeting_id, arr);
  }
  const participantDeptsByMeeting = new Map<string, (string | null | undefined)[]>();
  for (const row of (participants ?? []) as any[]) {
    const arr = participantDeptsByMeeting.get(row.meeting_id) ?? [];
    arr.push(row.profiles?.department_id ?? null);
    participantDeptsByMeeting.set(row.meeting_id, arr);
  }

  const relevantMeetingIds = new Set(
    all
      .filter((m) =>
        isMeetingRelevantToDepartment(m, profile.department_id, {
          meetingDepartments: deptPermsByMeeting.get(m.id) ?? [],
          participantDepartmentIds: participantDeptsByMeeting.get(m.id) ?? []
        })
      )
      .map((m) => m.id)
  );

  const filteredUnsorted = all.filter((m) => {
    if (m.meeting_type !== activeType) return false;
    if (q && !m.title.toLowerCase().includes(q.toLowerCase()) && !m.code.toLowerCase().includes(q.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Ngày - giờ bắt đầu, đến trước ở dòng trên; trùng giờ thì theo Tên hội nghị A -> Z.
  const filtered = sortMeetingsByStartThenTitle(filteredUnsorted, sort);

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ type: activeType, sort, ...(q ? { q } : {}), ...overrides });
    return `/meetings?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Cuộc họp" />

      <div className="hidden md:flex items-center justify-between">
        <h1 className="text-2xl">Cuộc họp</h1>
        {canCreateMeeting(profile) && (
          <Link href="/meetings/create" className="btn-primary">
            + Tạo cuộc họp
          </Link>
        )}
      </div>

      {/* Tab theo loại cuộc họp, kèm số lượng — khớp bản mẫu (Thường Kỳ / Chuyên đề) */}
      <div className="flex items-center gap-6 border-b border-line relative">
        {TABS.map((tab) => {
          const active = tab.type === activeType;
          return (
            <Link
              key={tab.type}
              href={qs({ type: tab.type })}
              className={`flex items-center gap-2 pb-2.5 -mb-px border-b-2 text-sm transition-colors ${
                active ? 'border-gold text-gold font-semibold' : 'border-transparent text-inksoft'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-semibold ${
                  active ? 'bg-gold text-white' : 'bg-paper2 text-inksoft'
                }`}
              >
                {counts[tab.type]}
              </span>
            </Link>
          );
        })}
        {canCreateMeeting(profile) && (
          <Link
            href="/meetings/create"
            aria-label="Tạo cuộc họp"
            className="md:hidden ml-auto mb-2 w-8 h-8 rounded-full bg-gold text-white flex items-center justify-center flex-shrink-0"
          >
            <IconPlus size={16} />
          </Link>
        )}
      </div>

      {/* Thanh công cụ: sắp xếp / tìm kiếm theo tiêu đề / bộ lọc nâng cao (sang trang Tìm kiếm) */}
      <div className="flex gap-2">
        <Link
          href={qs({ sort: sort === 'asc' ? 'desc' : 'asc' })}
          aria-label="Đổi thứ tự sắp xếp"
          title={sort === 'asc' ? 'Đang xếp: cũ → mới' : 'Đang xếp: mới → cũ'}
          className="w-11 h-11 rounded-lg border border-line flex items-center justify-center flex-shrink-0 text-inksoft hover:border-gold/40"
        >
          <IconSort size={18} />
        </Link>
        <form action="/meetings" method="get" className="flex-1 relative">
          <input type="hidden" name="type" value={activeType} />
          <input type="hidden" name="sort" value={sort} />
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inksoft" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm kiếm theo tiêu đề, mã cuộc họp"
            className="input h-11 !pl-9"
          />
        </form>
        <Link
          href="/search"
          aria-label="Bộ lọc nâng cao"
          title="Bộ lọc nâng cao"
          className="w-11 h-11 rounded-lg border border-line flex items-center justify-center flex-shrink-0 text-inksoft hover:border-gold/40"
        >
          <IconFilter size={18} />
        </Link>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <p className="table-empty card">Chưa có cuộc họp nào phù hợp.</p>}
        {filtered.map((m) => (
          <MeetingCard
            key={m.id}
            meeting={m}
            departmentName={m.departments?.name}
            showType={false}
            isRelevant={relevantMeetingIds.has(m.id)}
          />
        ))}
      </div>
    </div>
  );
}
