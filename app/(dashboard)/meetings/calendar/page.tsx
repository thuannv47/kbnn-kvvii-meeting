import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { sortMeetingsByStartThenTitle } from '@/lib/meetings/relevance';
import type { Meeting } from '@/types/meeting';
import PageHeader from '@/components/dashboard/page-header';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';
import { IconClock, IconPin } from '@/components/ui/icons';
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

  // Lấy cuộc họp GIAO với tháng đang xem (bắt đầu trước khi tháng kết thúc, và kết
  // thúc sau khi tháng bắt đầu) — để không bỏ sót cuộc họp qua đêm ở rìa tháng.
  // KHÔNG dùng quyền quản trị/service-role để "lấy hết mọi cuộc họp" — chỉ select()
  // bình thường bằng phiên đăng nhập hiện tại, để RLS (can_view_meeting) tự lọc
  // đúng những gì người này được phép xem, y hệt trang "Cuộc họp" dạng danh sách.
  // Nhờ vậy lịch tự động tôn trọng phân quyền theo từng cấp (ADMIN/BGD thấy nhiều
  // hơn, MEMBER/MANAGER chỉ thấy cuộc họp phòng mình + được mời), không cần thêm
  // logic phân quyền riêng cho trang này.
  const { data: meetingsRaw } = await supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)')
    .lt('start_at', monthEnd.toISOString())
    .gte('end_at', monthStart.toISOString());

  const meetings = sortMeetingsByStartThenTitle(
    (meetingsRaw ?? []) as (Meeting & { departments?: { name: string } })[],
    'asc'
  );

  const byDay = new Map<string, typeof meetings>();
  for (const m of meetings) {
    const key = dateKeyVN(m.start_at);
    const arr = byDay.get(key) ?? [];
    arr.push(m);
    byDay.set(key, arr);
  }

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

  // Lãnh đạo (BGĐ) tham dự — chỉ lấy cho các cuộc họp đang hiển thị trong ngày
  // được chọn, tra qua bảng meeting_participants (bảng tag người tham dự, vốn
  // dùng chung cho cả họp Nội bộ lẫn Ngoài ngành) rồi lọc theo role = 'BGD'.
  const selectedIds = selectedMeetings.map((m) => m.id);
  const { data: bgdParticipantsRaw } = selectedIds.length
    ? await supabase
        .from('meeting_participants')
        .select('meeting_id, profiles:user_id(full_name, role)')
        .in('meeting_id', selectedIds)
    : { data: [] };

  const bgdNamesByMeeting = new Map<string, string[]>();
  for (const row of (bgdParticipantsRaw ?? []) as any[]) {
    if (row.profiles?.role !== 'BGD') continue;
    const arr = bgdNamesByMeeting.get(row.meeting_id) ?? [];
    arr.push(row.profiles.full_name);
    bgdNamesByMeeting.set(row.meeting_id, arr);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Lịch họp" />

      <div className="hidden md:flex items-center justify-between">
        <h1 className="text-2xl">Lịch họp</h1>
        <Link href="/meetings" className="text-sm text-gold font-medium">
          Xem dạng danh sách →
        </Link>
      </div>
      <p className="hidden md:block text-sm text-inksoft -mt-3">
        Chỉ hiển thị những cuộc họp bạn được phép xem — đúng theo phân quyền hiện có.
      </p>
      <div className="md:hidden flex justify-end -mt-2">
        <Link href="/meetings" className="text-sm text-gold font-medium">
          Xem dạng danh sách →
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/meetings/calendar?month=${monthParam(prevMonth.getFullYear(), prevMonth.getMonth())}`}
            className="btn px-3 py-1.5 text-sm"
          >
            ← Tháng trước
          </Link>
          <h2 className="font-semibold text-base">
            Tháng {month + 1}/{year}
          </h2>
          <Link
            href={`/meetings/calendar?month=${monthParam(nextMonth.getFullYear(), nextMonth.getMonth())}`}
            className="btn px-3 py-1.5 text-sm"
          >
            Tháng sau →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-inksoft font-semibold mb-1.5">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map(({ date, key, inMonth }) => {
            const count = byDay.get(key)?.length ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <Link
                key={key}
                href={`/meetings/calendar?month=${monthParam(year, month)}&date=${key}`}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                  !inMonth ? 'text-inksoft/40' : 'text-ink'
                } ${isSelected ? 'bg-navy text-white' : isToday ? 'border border-gold' : 'hover:bg-paper'}`}
              >
                <span className={isSelected ? 'font-bold' : ''}>{date.getDate()}</span>
                {count > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-gold'}`}
                    aria-label={`${count} cuộc họp`}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2.5">
          {selectedKey === todayKey ? 'Hôm nay' : selectedKey} — {selectedMeetings.length} cuộc họp
        </h3>

        {selectedMeetings.length === 0 ? (
          <p className="table-empty card">Không có cuộc họp nào trong ngày này.</p>
        ) : (
          <div className="space-y-3">
            {selectedMeetings.map((m) => {
              const bgdNames = bgdNamesByMeeting.get(m.id) ?? [];
              return (
                <div key={m.id} className="card p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-inksoft">
                      <IconClock size={13} className="flex-shrink-0" />
                      {formatTimeVN(m.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {formatTimeVN(m.end_at, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <MeetingStatusBadge meeting={m} now={now} />
                  </div>

                  <h4 className="font-semibold leading-snug text-sm mt-1.5">{m.title}</h4>

                  {bgdNames.length > 0 && (
                    <p className="mt-1.5 text-xs text-inksoft leading-snug">
                      <span className="font-medium text-ink">Lãnh đạo tham dự:</span> BGĐ ({bgdNames.join(', ')})
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-inksoft min-w-0">
                    <IconPin size={13} className="flex-shrink-0" />
                    <span className="truncate">
                      {m.location || (m.meeting_type === 'EXTERNAL' ? 'Ngoài ngành' : m.departments?.name ?? 'Nội bộ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
