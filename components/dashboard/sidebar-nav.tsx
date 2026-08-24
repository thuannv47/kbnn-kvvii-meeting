'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Profile } from '@/types/user';
import { canManageOrg } from '@/lib/permissions';
import RoleBadge from '@/components/ui/role-badge';
import LogoutButton from '@/components/dashboard/logout-button';

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  BGD: 'Ban Giám đốc',
  MANAGER: 'Trưởng/Phó phòng',
  MEMBER: 'Chuyên viên'
};

export default function SidebarNav({
  profile,
  departmentName
}: {
  profile: Profile;
  departmentName?: string | null;
}) {
  return (
    <aside className="hidden md:flex md:flex-col bg-ink text-paper px-4 py-6">
      <div className="font-display text-white font-semibold mb-6 px-2">Phòng họp không giấy tờ</div>

      <nav className="flex-1 space-y-0.5">
        <NavItem href="/dashboard" icon="🏠" label="Trang chủ" />
        <NavItem href="/meetings" icon="📅" label="Cuộc họp" />
        <NavItem href="/search" icon="🔎" label="Tìm kiếm" />
        <NavItem href="/departments" icon="🏢" label="Phòng ban" />
        {canManageOrg(profile) && <NavItem href="/users" icon="👤" label="Người dùng" />}
        {canManageOrg(profile) && <NavItem href="/admin" icon="🛡️" label="Quản trị / Audit" />}
      </nav>

      <div className="border-t border-white/10 pt-4 mt-4">
        <Link href="/account" className="block hover:opacity-80 transition-opacity">
          <div className="text-white text-sm font-medium">{profile.full_name}</div>
          <div className="text-paper/60 text-xs mb-2">
            {roleLabel[profile.role]} {departmentName ? `· ${departmentName}` : ''}
          </div>
        </Link>
        <RoleBadge role={profile.role} />
        <div className="mt-3 space-y-1.5">
          <Link href="/account" className="block text-xs text-paper/85 underline hover:text-white">
            Tài khoản / Đổi mật khẩu
          </Link>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  // "/departments" không được coi là active khi đang ở "/department-x-khac" — dùng ranh giới "/" rõ ràng
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-white/12 text-white font-semibold'
          : 'text-paper/85 hover:bg-white/10 hover:text-white'
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-4 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-gold-soft"
        />
      )}
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
