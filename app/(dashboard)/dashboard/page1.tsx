import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';
import DashboardBanner from '@/components/dashboard/dashboard-banner';
import type { Meeting } from '@/types/meeting';
import { IconCalendar, IconSearch, IconBuilding, IconUser, IconUsers, IconShield } from '@/components/ui/icons';

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: dept } = await supabase
    .from('departments')
    .select('name')
    .eq('id', profile.department_id)
    .maybeSingle();

  // Dashboard: chỉ xét cuộc họp còn trong thời gian hiển thị (visible_until).
  // RLS đã tự lọc theo quyền xem, ở đây chỉ lọc thêm điều kiện visible_until cho Dashboard.
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso);
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .or(`visible_until.is.null,visible_until.gte.${nowIso}`)
    .order('start_at', { ascending: true });

  const list = (meetings ?? []) as Meeting[];

  // Chọn 1 cuộc họp "gần nhất" để nổi bật trên trang chủ, theo thứ tự ưu tiên:
  // đang diễn ra > sắp diễn ra sớm nhất > vừa kết thúc gần nhất.
  const live = list.find((m) => getMeetingDisplayStatus(m, now).key === 'LIVE');
  const upcoming = list
    .filter((m) => getMeetingDisplayStatus(m, now).key === 'UPCOMING')
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
  const done = list
    .filter((m) => getMeetingDisplayStatus(m, now).key === 'DONE')
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime())[0];
  const nearest = live ?? upcoming ?? done;

  const quickLinks = [
    { href: '/meetings', icon: IconCalendar, label: 'Cuộc họp', tile: 'icon-tile-peach' as const },
    { href: '/search', icon: IconSearch, label: 'Tìm kiếm', tile: 'icon-tile-violet' as const },
    { href: '/departments', icon: IconBuilding, label: 'Phòng ban', tile: 'icon-tile-rose' as const },
    { href: '/account', icon: IconUser, label: 'Tài khoản', tile: 'icon-tile-slate' as const },
    ...(canManageOrg(profile)
      ? [
          { href: '/users', icon: IconUsers, label: 'Người dùng', tile: 'icon-tile-amber' as const },
          { href: '/admin', icon: IconShield, label: 'Quản trị / Audit', tile: 'icon-tile-indigo' as const }
        ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <DashboardBanner profile={profile} departmentName={dept?.name} />

      <div className="hidden md:block">
        <h1 className="text-2xl">Trang chủ</h1>
      </div>

      {/* Lưới truy cập nhanh — khớp bố cục bản mẫu (4 icon/hàng) */}
      <div className="grid grid-cols-4 gap-4">
        {quickLinks.map(({ href, icon: Icon, label, tile }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-2 text-center">
            <span className={tile}>
              <Icon size={24} />
            </span>
            <span className="text-[11.5px] leading-tight text-ink">{label}</span>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="font-semibold mb-2.5">Cuộc họp gần nhất</h2>

        {!nearest ? (
          <p className="table-empty card">Hiện không có cuộc họp nào trong hạn hiển thị.</p>
        ) : (
          <Link href={`/meetings/${nearest.id}`} className="card block p-4 hover:border-gold/40 transition-colors">
            <div className="flex items-start gap-3">
              <span className="icon-tile-peach flex-shrink-0">
                <IconCalendar size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-snug mb-1">{nearest.title}</h3>
                <p className="text-xs text-inksoft">
                  {new Date(nearest.start_at).toLocaleDateString('vi-VN')}{' '}
                  {new Date(nearest.start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}-
                  {new Date(nearest.end_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            {/* Thay cho nút hành động (VD "Báo vắng") — hiển thị trạng thái thực tế của cuộc họp */}
            <div className="mt-3 pt-3 border-t border-line">
              <MeetingStatusBadge meeting={nearest} now={now} />
            </div>
          </Link>
        )}

        <Link href="/meetings" className="inline-block mt-3 text-sm text-gold font-medium">
          Xem tất cả cuộc họp →
        </Link>
      </div>
    </div>
  );
}
