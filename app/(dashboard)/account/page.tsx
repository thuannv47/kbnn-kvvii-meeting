import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import RoleBadge from '@/components/ui/role-badge';
import ChangePasswordForm from '@/components/dashboard/change-password-form';

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  BGD: 'Ban Giám đốc',
  MANAGER: 'Trưởng/Phó phòng',
  MEMBER: 'Chuyên viên'
};

export default async function AccountPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: dept } = await supabase
    .from('departments')
    .select('name')
    .eq('id', profile.department_id)
    .maybeSingle();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Tài khoản của tôi</h1>
        <p className="text-inksoft text-sm mt-1">Thông tin cá nhân và bảo mật đăng nhập.</p>
      </div>

      <div className="card p-5 max-w-md space-y-1.5">
        <div className="text-sm">
          <span className="text-inksoft">Họ tên: </span>
          <span className="font-medium">{profile.full_name}</span>
        </div>
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
        <div className="text-sm flex items-center gap-2">
          <span className="text-inksoft">Vai trò: </span>
          <RoleBadge role={profile.role} />
          <span className="text-inksoft text-xs">({roleLabel[profile.role]})</span>
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
