'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Profile } from '@/types/user';
import { canManageOrg } from '@/lib/permissions';
import LogoutButton from '@/components/dashboard/logout-button';
import {
  IconHome,
  IconCalendar,
  IconSearch,
  IconBuilding,
  IconUser,
  IconShield
} from '@/components/ui/icons';

export default function SidebarNav({
  profile,
  departmentName
}: {
  profile: Profile;
  departmentName?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col relative overflow-hidden bg-navy text-paper">
      {/* Hoạ tiết trang trí mờ phía dưới sidebar — cùng tinh thần hoa sen của bản mẫu,
          chỉ dùng CSS radial-gradient nên không cần thêm ảnh. */}
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 w-56 h-56 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="relative flex items-center gap-3 px-5 pt-6 pb-5 border-b border-white/10">
        <img src="/logo-kbnn.png" alt="" className="w-11 h-11 rounded-full bg-white/10 object-contain p-1 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/70 truncate">
            Kho bạc Nhà nước KVII
          </div>
          <div className="font-display text-white font-bold leading-tight text-[15px]">
            Phòng họp không giấy tờ
          </div>
        </div>
      </div>
      <p className="relative px-5 pt-3 pb-1 text-[11px] text-white/55 tracking-wide">
        Hiện đại · Hiệu quả · Kết nối
      </p>

      <nav className="relative flex-1 px-3 py-3 space-y-0.5">
        <NavItem href="/dashboard" icon={<IconHome size={18} />} label="Trang chủ" pathname={pathname} />
        <NavItem href="/meetings" icon={<IconCalendar size={18} />} label="Cuộc họp" pathname={pathname} />
        <NavItem href="/search" icon={<IconSearch size={18} />} label="Tìm kiếm" pathname={pathname} />
        <NavItem href="/departments" icon={<IconBuilding size={18} />} label="Phòng ban" pathname={pathname} />
        <NavItem href="/account" icon={<IconUser size={18} />} label="Tài khoản" pathname={pathname} />
        {canManageOrg(profile) && (
          <NavItem href="/users" icon={<IconUser size={18} />} label="Người dùng" pathname={pathname} />
        )}
        {canManageOrg(profile) && (
          <NavItem href="/admin" icon={<IconShield size={18} />} label="Quản trị / Audit" pathname={pathname} />
        )}
      </nav>

      <div className="relative border-t border-white/10 p-4">
        <Link
          href="/account"
          className="flex items-center gap-3 rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors p-3"
        >
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 text-white">
            <IconUser size={17} />
          </span>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{profile.full_name}</div>
            <div className="text-paper/60 text-[11px] truncate">
              {profile.position || '—'} {departmentName ? `· ${departmentName}` : ''}
            </div>
          </div>
        </Link>
        <div className="mt-2.5 space-y-1.5 px-1">
          <Link href="/account" className="block text-xs text-paper/85 underline hover:text-white">
            Tài khoản / Đổi mật khẩu
          </Link>
          <LogoutButton compact />
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  pathname
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  pathname: string;
}) {
  // "/admin" phải khớp chính xác hoặc là tiền tố có dấu "/" theo sau,
  // để không lỡ tô sáng nhầm mục khác có tiền tố trùng.
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-2.5 pl-3 pr-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-white text-navy font-semibold'
          : 'text-paper/85 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className={active ? 'opacity-100' : 'opacity-80'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
