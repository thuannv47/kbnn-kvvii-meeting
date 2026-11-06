import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import type { Meeting, MeetingType, MeetingStatus } from '@/types/meeting';
import PageHeader from '@/components/dashboard/page-header';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';
import { IconClock, IconPin, IconBack, IconChevronRight } from '@/components/ui/icons';
import { formatTimeVN } from '@/lib/format-date';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** "2026-09" -> { year, month(0-based) }. Mặc định tháng hiện tại nếu tham số sai định dạng. */
function parseMonthParam(param: string | undefined) {
  const now = new Date();
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function dateKeyVN(iso: string) {
  // Khoá theo NGÀY dương lịch giờ Việt Nam (UTC+7), tránh lệch ngày do server chạy UTC.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // "YYYY-MM-DD"
}

type CalendarMeeting = Pick<Meeting, 'id' | 'code' | 'title' | 'meeting_type' | 'status' | 'location' | 'start_at' | 'end_at'> & {
  departments?: { name: string };
  leaders: { bgd: string[]; manager: string[] };
  /** Người được cử đi — chỉ có với họp NGOÀI NGÀNH, để Văn phòng bố trí xe/hậu cần. */
  attendees: { full_name: string; position: string | null; department_name: string | null }[];
  /** Tổng số người được tick tham dự + số người theo từng phòng ban — để bố trí hội trường. */
  attendeeCount: number;
  attendeeDepartments: { name: string; count: number }[];
};

export default async function MeetingsCalendarPage({
  searchParams
}: {
  searchParams: { month?: string; date?: string };
}) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  const { year, month } = parseMonthParam(searchParams.month);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso);

  const todayKey = dateKeyVN(nowIso);
  const selectedKey =
    searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayKey;

  // ---- NGUỒN 1: Lịch họp toàn ngành (nội bộ + ngoài ngành) (RPC meetings_overview, xem migration
  // 0013) — mọi tài khoản đang hoạt động đều thấy được, KHÔNG phụ thuộc "liên quan
  // phòng ban" như trang "Cuộc họp" dạng danh sách, để Văn phòng và các phòng khác
  // chủ động biết trước lịch mà bố trí hội trường/hậu cần, và biết lãnh đạo (BGĐ/
  // Trưởng-phó phòng) đang bận giờ nào. Chỉ trả về cột hiển thị trên lịch — KHÔNG
  // có summary/tài liệu/ý kiến/kết luận, những thứ đó vẫn theo đúng phân quyền cũ
  // ở trang chi tiết cuộc họp (canViewMeeting() không hề bị nới lỏng).
  const { data: overviewRaw } = await supabase.rpc('meetings_overview', {
    month_start: monthStart.toISOString(),
    month_end: monthEnd.toISOString()
  });

  // ---- NGUỒN 2: Phạm vi riêng theo phiên đăng nhập hiện tại (RLS tự lọc) — để
  // không bỏ sót những cuộc họp người này thấy được nhờ quyền cá nhân mà RPC ở
  // trên không phủ tới: cuộc họp Nháp do CHÍNH mình tạo, hoặc họp NGOÀI NGÀNH
  // mình được TAG/tạo (Ngoài ngành cố ý không đưa vào RPC vì có thể nhạy cảm và
  // không liên quan tới việc bố trí hội trường nội bộ).
  const { data: ownScopeRaw } = await supabase
    .from('meetings')
    .select(
      '*, departments:host_department_id(name), meeting_participants(user_id, profiles:user_id(full_name, role, position, departments:department_id(name)))'
    )
    .lt('start_at', monthEnd.toISOString())
    .gte('end_at', monthStart.toISOString());

  const merged = new Map<string, CalendarMeeting>();

  for (const row of (overviewRaw ?? []) as any[]) {
    const leaders = { bgd: [] as string[], manager: [] as string[] };
    for (const l of (row.leaders ?? []) as { full_name: string; role: string }[]) {
      if (l.role === 'BGD') leaders.bgd.push(l.full_name);
      else if (l.role === 'MANAGER') leaders.manager.push(l.full_name);
    }
    merged.set(row.id, {
      id: row.id,
      code: row.code,
      title: row.title,
      meeting_type: row.meeting_type as MeetingType,
      status: row.status as MeetingStatus,
      location: row.location,
      start_at: row.start_at,
      end_at: row.end_at,
      departments: row.host_department_name ? { name: row.host_department_name } : undefined,
      leaders,
      attendees: ((row.attendees ?? []) as any[]).map((a) => ({
        full_name: a.full_name,
        position: a.position ?? null,
        department_name: a.department_name ?? null
      })),
      attendeeCount: Number(row.attendee_count ?? 0),
      attendeeDepartments: ((row.attendee_departments ?? []) as any[]).map((d) => ({
        name: d.name,
        count: Number(d.count)
      }))
    });
  }

  for (const row of (ownScopeRaw ?? []) as any[]) {
    const leaders = { bgd: [] as string[], manager: [] as string[] };
    const attendees: CalendarMeeting['attendees'] = [];
    const deptCounts = new Map<string, number>();
    for (const p of (row.meeting_participants ?? []) as any[]) {
      {
        const dep0 = p.profiles?.departments;
        const depName = (Array.isArray(dep0) ? dep0[0]?.name : dep0?.name) ?? 'Khác';
        deptCounts.set(depName, (deptCounts.get(depName) ?? 0) + 1);
      }
      const role = p.profiles?.role;
      if (role === 'BGD') leaders.bgd.push(p.profiles.full_name);
      else if (role === 'MANAGER') leaders.manager.push(p.profiles.full_name);
      if (row.meeting_type === 'EXTERNAL' && p.profiles) {
        const dep = p.profiles.departments;
        attendees.push({
          full_name: p.profiles.full_name,
          position: p.profiles.position ?? null,
          department_name: (Array.isArray(dep) ? dep[0]?.name : dep?.name) ?? null
        });
      }
    }
    // Nếu cuộc họp đã có sẵn từ RPC (trường hợp hiếm — vd. RPC vừa thêm sau khi
    // đã đọc), giữ lại bản có nhiều thông tin lãnh đạo hơn thay vì ghi đè trắng.
    const existing = merged.get(row.id);
    merged.set(row.id, {
      id: row.id,
      code: row.code,
      title: row.title,
      meeting_type: row.meeting_type,
      status: row.status,
      location: row.location,
      start_at: row.start_at,
      end_at: row.end_at,
      departments: row.departments,
      leaders: existing && (existing.leaders.bgd.length || existing.leaders.manager.length) ? existing.leaders : leaders,
      attendees: existing && existing.attendees.length ? existing.attendees : attendees,
      attendeeCount: existing && existing.attendeeCount ? existing.attendeeCount : (row.meeting_participants ?? []).length,
      attendeeDepartments:
        existing && existing.attendeeDepartments.length
          ? existing.attendeeDepartments
          : [...deptCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    });
  }

  const meetings = sortMeetingsByStartThenTitle([...merged.values()] as any, 'asc') as CalendarMeeting[];

  const byDay = new Map<string, CalendarMeeting[]>();
  for (const m of meetings) {
    const key = dateKeyVN(m.start_at);
    const arr = byDay.get(key) ?? [];
    arr.push(m);
    byDay.set(key, arr);
  }
  // Ngày có ít nhất 1 cuộc họp mà lãnh đạo (BGĐ/Trưởng-phó phòng) được tag tham dự
  // -> tô chấm trên lịch màu khác hẳn, để lướt lịch là thấy ngay hôm nào lãnh đạo bận.
  const daysWithLeader = new Set(
    meetings.filter((m) => m.leaders.bgd.length > 0 || m.leaders.manager.length > 0).map((m) => dateKeyVN(m.start_at))
  );

  // ---- Dựng lưới 6 hàng x 7 cột (Thứ 2 -> Chủ nhật), gồm cả ngày tháng trước/sau để lấp đầy tuần ----
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = Thứ 2
  const gridStart = new Date(year, month, 1 - firstWeekday);
  const cells: { date: Date; key: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, key: dateKeyVN(d.toISOString()), inMonth: d.getMonth() === month });
  }

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const selectedMeetings = (byDay.get(selectedKey) ?? []).slice();

  const selectedDateObj = new Date(`${selectedKey}T00:00:00`);
  const selectedLabel =
    selectedKey === todayKey
      ? 'Hôm nay'
      : `${WEEKDAY_LABELS[(selectedDateObj.getDay() + 6) % 7]}, ${selectedDateObj.getDate()}/${selectedDateObj.getMonth() + 1}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Lịch họp" />

      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-2xl">Lịch họp</h1>
        <p className="hidden md:block text-sm text-inksoft max-w-md">
          Hiển thị cho toàn thể cán bộ để tiện bố trí hội trường, xe và công tác văn phòng. Chi tiết cuộc
          họp (tài liệu, ý kiến, kết luận) vẫn theo đúng phân quyền như trước.
        </p>
        <Link href="/meetings" className="text-sm text-gold font-medium flex-shrink-0 ml-auto">
          Xem dạng danh sách →
        </Link>
      </div>

      <div className="md:grid md:grid-cols-[300px_1fr] md:gap-5 md:items-start">
        {/* ---- Lịch tháng: thu gọn hẳn (ô cố định chiều cao thay vì vuông theo bề
            ngang) để không còn chiếm phần lớn màn hình, dành chỗ cho danh sách. ---- */}
        <div className="card p-3.5 md:sticky md:top-5">
          <div className="flex items-center justify-between mb-3">
            <Link
              href={`/meetings/calendar?month=${monthParam(prevMonth.getFullYear(), prevMonth.getMonth())}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:border-gold transition-colors flex-shrink-0"
              aria-label="Tháng trước"
            >
              <IconBack size={16} />
            </Link>
            <h2 className="font-display font-semibold text-[15px]">
              Tháng {month + 1}/{year}
            </h2>
            <Link
              href={`/meetings/calendar?month=${monthParam(nextMonth.getFullYear(), nextMonth.getMonth())}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:border-gold transition-colors flex-shrink-0"
              aria-label="Tháng sau"
            >
              <IconChevronRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-7 text-center text-[10.5px] text-inksoft font-semibold mb-1">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="h-5 flex items-center justify-center">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map(({ date, key, inMonth }) => {
              const count = byDay.get(key)?.length ?? 0;
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              const hasLeader = daysWithLeader.has(key);
              return (
                <Link
                  key={key}
                  href={`/meetings/calendar?month=${monthParam(year, month)}&date=${key}`}
                  className="h-9 flex items-center justify-center"
                >
                  <span
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[12.5px] transition-colors ${
                      !inMonth ? 'text-inksoft/35' : 'text-ink'
                    } ${
                      isSelected ? 'bg-navy text-white font-semibold' : isToday ? 'border border-gold font-semibold' : 'hover:bg-paper'
                    }`}
                  >
                    {date.getDate()}
                    {count > 0 && (
                      <span
                        className={`absolute -bottom-0.5 w-1 h-1 rounded-full ${
                          isSelected ? 'bg-white' : hasLeader ? 'bg-gold' : 'bg-navy/50'
                        }`}
                        aria-hidden
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-line text-[11px] text-inksoft">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Có lãnh đạo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-navy/50" /> Có cuộc họp
            </span>
          </div>
        </div>

        {/* ---- Danh sách cuộc họp trong ngày đang chọn: nhiều chỗ hơn hẳn để đọc,
            không còn bị co lại nhường chỗ cho lịch. ---- */}
        <div className="mt-5 md:mt-0">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-semibold text-base">{selectedLabel}</h3>
            <span className="text-xs text-inksoft flex-shrink-0">{selectedMeetings.length} cuộc họp</span>
          </div>

          {selectedMeetings.length === 0 ? (
            <p className="table-empty card">Không có cuộc họp nào trong ngày này.</p>
          ) : (
            <div className="space-y-3">
              {selectedMeetings.map((m) => {
                const { bgd, manager } = m.leaders;
                const leaderParts = [
                  bgd.length ? `BGĐ (${bgd.join(', ')})` : null,
                  manager.length ? `Trưởng/phó phòng (${manager.join(', ')})` : null
                ].filter(Boolean);
                const accentColor = m.meeting_type === 'EXTERNAL' ? '#5B4FC4' : '#1D4ED8';
                return (
                  <div
                    key={m.id}
                    className="card p-4 border-l-[3px]"
                    style={{ borderLeftColor: accentColor }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-display font-semibold leading-snug text-[15px] min-w-0 flex-1">
                        {m.title}
                      </h4>
                      <MeetingStatusBadge meeting={m as any} now={now} />
                    </div>

                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-2.5 text-[13px] text-inksoft">
                      <span className="inline-flex items-center gap-1.5">
                        <IconClock size={14} className="flex-shrink-0" />
                        {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <IconPin size={14} className="flex-shrink-0" />
                        <span className="truncate">
                          {m.location ||
                            (m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : m.departments?.name ?? 'Nội bộ')}
                        </span>
                      </span>
                      <span className={m.meeting_type === 'EXTERNAL' ? 'badge-external' : 'badge-internal'}>
                        {m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : 'Nội bộ'}
                      </span>
                    </div>

                    {m.meeting_type === 'EXTERNAL' && m.attendees.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-line text-[13px] text-inksoft leading-snug">
                        <span className="font-medium text-ink">Người được cử đi ({m.attendees.length}): </span>
                        {m.attendees
                          .map((a) => {
                            const extra = [a.position, a.department_name].filter(Boolean).join(', ');
                            return extra ? `${a.full_name} (${extra})` : a.full_name;
                          })
                          .join(' · ')}
                      </div>
                    )}

                    {m.meeting_type !== 'EXTERNAL' && m.attendeeCount > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-line text-[13px] text-inksoft leading-snug">
                        <span className="font-medium text-ink">Số người tham dự: {m.attendeeCount}</span>
                        {m.attendeeDepartments.length > 0 && (
                          <>
                            {' — '}
                            {m.attendeeDepartments.map((d) => `${d.name} (${d.count})`).join(' · ')}
                          </>
                        )}
                      </div>
                    )}

                    {!(m.meeting_type === 'EXTERNAL' && m.attendees.length > 0) && leaderParts.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-line text-[13px] text-inksoft leading-snug">
                        <span className="font-medium text-ink">Lãnh đạo tham dự: </span>
                        {leaderParts.join(' · ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
