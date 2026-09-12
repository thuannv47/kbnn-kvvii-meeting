'use client';

import { useMemo, useState } from 'react';
import { IconChevronRight } from '@/components/ui/icons';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * Lịch mini hiển thị tháng hiện tại — chấm đỏ đánh dấu ngày có cuộc họp
 * (dùng đúng dữ liệu cuộc họp đã tải sẵn ở trang Trang chủ, không gọi API
 * riêng). Chỉ điều hướng qua lại giữa các tháng, không phải lịch đầy đủ
 * kiểu Google Calendar.
 */
export default function MiniCalendar({ meetingDates }: { meetingDates: string[] }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const markedDays = useMemo(() => {
    const set = new Set<number>();
    for (const iso of meetingDates) {
      const d = new Date(iso);
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        set.add(d.getDate());
      }
    }
    return set;
  }, [meetingDates, cursor]);

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  // Thứ trong tuần của ngày 1 — quy đổi để Thứ 2 là cột đầu tiên (giống lịch VN).
  const firstWeekday = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const isToday = (day: number) =>
    day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">
          Lịch tháng {cursor.getMonth() + 1}/{cursor.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-paper2 text-inksoft"
          >
            <span className="rotate-180 inline-block">
              <IconChevronRight size={14} />
            </span>
          </button>
          <button
            type="button"
            aria-label="Tháng sau"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-paper2 text-inksoft"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] font-semibold text-inksoft">
            {w}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="relative flex items-center justify-center h-7">
            {day && (
              <span
                className={`w-7 h-7 flex items-center justify-center rounded-full text-[12px] ${
                  isToday(day) ? 'bg-gold text-white font-semibold' : 'text-ink'
                }`}
              >
                {day}
              </span>
            )}
            {day && markedDays.has(day) && !isToday(day) && (
              <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-inksoft">
        <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        Ngày có cuộc họp
      </div>
    </div>
  );
}
