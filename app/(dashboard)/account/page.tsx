import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import RoleBadge from '@/components/ui/role-badge';
import ChangePasswordForm from '@/components/dashboard/change-password-form';
import LogoutButton from '@/components/dashboard/logout-button';
import PageHeader from '@/components/dashboard/page-header';
import PushSubscribeButton from '@/components/notifications/push-subscribe-button';
import {
  IconUser,
  IconCamera,
  IconCalendar,
  IconSearch,
  IconBuilding,
  IconUsers,
  IconShield,
  IconChevronRight
} from '@/components/ui/icons';

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  BGD: 'Ban Giám đốc',
  MANAGER: 'Trưởng/Phó phòng',
  MEMBER: 'Chuyên viên',
  THUKY: 'Thư ký'
};

export default async function AccountPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: dept } = await supabase
    .from('departments')
    .select('name')
    .eq('id', profile.department_id)
    .maybeSingle();

  const features = [
    { href: '/meetings', icon: IconCalendar, label: 'Cuộc họp' },
    { href: '/search', icon: IconSearch, label: 'Tìm kiếm lịch sử' },
    { href: '/departments', icon: IconBuilding, label: 'Phòng ban' },
    ...(canManageOrg(profile)
      ? [
          { href: '/users', icon: IconUsers, label: 'Người dùng' },
          { href: '/admin', icon: IconShield, label: 'Quản trị / Audit' }
        ]
      : [])
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Tài khoản" />
      <h1 className="hidden md:block font-display text-xl font-semibold">Tài khoản của tôi</h1>

      {/* Thẻ hồ sơ */}
      <div className="card p-5 flex items-center gap-4">
        <span className="relative flex-shrink-0">
          <span className="w-16 h-16 rounded-full bg-paper2 flex items-center justify-center text-inksoft">
            <IconUser size={28} />
          </span>
          {/* Trang trí, tính năng đổi ảnh đại diện chưa được nối API */}
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gold text-white flex items-center justify-center border-2 border-surface">
            <IconCamera size={12} />
          </span>
        </span>
        <div className="min-w-0">
          <div className="font-semibold truncate">{profile.full_name}</div>
          <div className="text-sm text-inksoft truncate mb-1.5">
            {profile.position ? `${profile.position} · ` : ''}
            {dept?.name || '—'}
          </div>
          <RoleBadge role={profile.role} />
        </div>
      </div>

      {/* Thông tin tài khoản */}
      <div className="card p-5 space-y-1.5">
        <h2 className="font-semibold mb-2 text-sm">Thông tin tài khoản</h2>
        <div className="text-sm">
          <span className="text-inksoft">Tên đăng nhập: </span>
          <span className="font-medium">{profile.username}</span>
        </div>
        <div className="text-sm">
          <span className="text-inksoft">Chức danh: </span>
          <span className="font-medium">{profile.position || '—'}</span>
        </div>
        <div className="text-sm">
          <span className="text-inksoft">Phòng ban: </span>
          <span className="font-medium">{dept?.name || '—'}</span>
        </div>
        <div className="text-sm">
          <span className="text-inksoft">Vai trò: </span>
          <span className="font-medium">{roleLabel[profile.role]}</span>
        </div>
      </div>

      {/* Chức năng — lối tắt tới các phần chính của hệ thống */}
      <div className="card divide-y divide-line overflow-hidden">
        <h2 className="font-semibold text-sm px-5 pt-4 pb-2">Chức năng</h2>
        {features.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-paper2/50">
            <span className="text-gold flex-shrink-0">
              <Icon size={20} />
            </span>
            <span className="flex-1 text-sm">{label}</span>
            <IconChevronRight size={16} className="text-inksoft" aria-hidden />
          </Link>
        ))}
      </div>

      {/* Thông báo đẩy — bật để nhận thông báo khi được cử tham dự cuộc họp mới */}
      <PushSubscribeButton />

      {/* Cài đặt */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Cài đặt</h2>
        <details className="group">
          <summary className="list-none flex items-center gap-3 px-5 py-3 card cursor-pointer">
            <span className="flex-1 text-sm font-medium">Đổi mật khẩu</span>
            <IconChevronRight size={16} className="text-inksoft transition-transform group-open:rotate-90" aria-hidden />
          </summary>
          <div className="mt-3">
            <ChangePasswordForm />
          </div>
        </details>

        <div className="card px-5 py-3">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
