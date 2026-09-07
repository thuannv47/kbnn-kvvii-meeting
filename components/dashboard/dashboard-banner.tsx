import Link from 'next/link';
import type { Profile } from '@/types/user';
import { IconUser, IconBell } from '@/components/ui/icons';

/**
 * Banner đỏ đô ở đầu Trang chủ, chỉ hiển thị trên mobile — khớp với bản mẫu.
 * Trên desktop, thông tin người dùng đã có sẵn ở cuối SidebarNav nên không lặp lại.
 */
export default function DashboardBanner({
  profile,
  departmentName
}: {
  profile: Profile;
  departmentName?: string | null;
}) {
  return (
    <div className="md:hidden -mx-4 -mt-5 mb-5 px-4 pt-4 pb-5 banner-brand">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
          <IconUser size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold uppercase tracking-wide truncate">{profile.full_name}</div>
          <div className="text-xs text-white/75 truncate">
            {profile.position || '—'}
            {departmentName ? ` · ${departmentName}` : ''}
          </div>
        </div>
        {/* Placeholder cho tính năng thông báo trong tương lai — hiện chưa nối API */}
        <Link href="/account" className="p-2 -m-2 text-white/85" aria-label="Thông báo">
          <IconBell size={20} />
        </Link>
      </div>
    </div>
  );
}
