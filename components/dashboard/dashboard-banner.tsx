import Link from 'next/link';
import type { Profile } from '@/types/user';
import { IconUser, IconBell } from '@/components/ui/icons';

const WEEKDAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/**
 * Thanh đầu trang đỏ đô ở Trang chủ, chỉ hiển thị trên mobile — khớp bản mẫu:
 * logo + tên hệ thống bên trái, chuông thông báo + tên người dùng bên phải,
 * cùng một dòng chào + ngày tháng bên dưới để banner có trọng lượng thị giác
 * tương xứng với vai trò "đầu trang" thay vì chỉ là một dải mỏng.
 * Trên desktop, thông tin này đã có sẵn ở SidebarNav nên không lặp lại.
 */
export default function DashboardBanner({
  profile,
  departmentName,
  relatedMeetingCount = 0
}: {
  profile: Profile;
  departmentName?: string | null;
  /** Số cuộc họp đang/sắp diễn ra liên quan đến người này — hiện thành huy hiệu đỏ trên chuông. */
  relatedMeetingCount?: number;
}) {
  const now = new Date();
  const todayLabel = `${WEEKDAYS_VN[now.getDay()]}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const firstName = profile.full_name?.trim().split(/\s+/).pop() ?? profile.full_name;

  return (
    <div className="md:hidden -mx-4 -mt-5 mb-5 px-5 pt-6 pb-7 banner-brand relative overflow-hidden rounded-b-[24px]">
      {/* Hoạ tiết vòng tròn mờ trang trí, cắt gọn trong banner */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 w-36 h-36 rounded-full bg-black/[0.10]" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo-kbnn.png" alt="" className="w-10 h-10 rounded-full bg-white/10 object-contain p-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70 truncate">
              Kho bạc Nhà nước KHU VỰC VII
            </div>
            <div className="text-sm font-bold leading-tight truncate">Phòng họp không giấy tờ</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Huy hiệu = số cuộc họp đang/sắp diễn ra liên quan đến người này (trùng số liệu
              mục "Cuộc họp sắp diễn ra" bên dưới) — bấm vào dẫn thẳng tới Lịch họp để xem. */}
          <Link href="/meetings/calendar" className="relative p-1.5 -m-1.5 text-white/85" aria-label="Lịch họp">
            <IconBell size={19} />
            {relatedMeetingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {relatedMeetingCount > 99 ? '99+' : relatedMeetingCount}
              </span>
            )}
          </Link>
          <Link href="/account" className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <IconUser size={17} />
            </span>
          </Link>
        </div>
      </div>

      <div className="relative mt-6 pt-4 border-t border-white/15">
        <div className="text-[19px] font-bold leading-tight truncate">Xin chào, {firstName}</div>
        <div className="text-[12.5px] text-white/70 mt-1 truncate">
          {departmentName ? `${departmentName} · ` : ''}
          {todayLabel}
        </div>
      </div>
    </div>
  );
}
