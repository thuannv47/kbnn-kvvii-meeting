import Link from 'next/link';
import type { Profile } from '@/types/user';
import { IconUser, IconBell } from '@/components/ui/icons';

/**
 * Thanh đầu trang đỏ đô ở Trang chủ, chỉ hiển thị trên mobile — khớp bản mẫu:
 * logo + tên hệ thống bên trái, chuông thông báo + tên người dùng bên phải.
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
  return (
    <div className="md:hidden -mx-4 -mt-5 mb-5 px-4 pt-5 pb-5 banner-brand">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo-kbnn.png" alt="" className="w-9 h-9 rounded-full bg-white/10 object-contain p-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70 truncate">
              Kho bạc Nhà nước KHU VỰC VII
            </div>
            <div className="text-[13px] font-bold leading-tight truncate">Phòng họp không giấy tờ</div>
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
            <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <IconUser size={16} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
