import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import RoleBadge from '@/components/ui/role-badge';
import UserForm from '@/components/dashboard/user-form';
import UserRowActions from '@/components/dashboard/user-row-actions';

export default async function UsersPage() {
  const { profile } = await requireUser();
  if (!canManageOrg(profile)) redirect('/dashboard');

  const supabase = createServerSupabase();
  const [{ data: users }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*, departments:department_id(name)').order('full_name'),
    supabase.from('departments').select('*').eq('active', true).order('name')
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Người dùng</h1>

      <UserForm departments={departments ?? []} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-inksoft border-b border-line">
              <th className="px-4 py-3 font-medium">Họ tên</th>
              <th className="px-4 py-3 font-medium">Tên đăng nhập</th>
              <th className="px-4 py-3 font-medium">Phòng ban</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Chức danh</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: any) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-inksoft">{u.username}</td>
                <td className="px-4 py-3">{u.departments?.name}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3">{u.position}</td>
                <td className="px-4 py-3">{u.active ? 'Hoạt động' : 'Ngừng'}</td>
                <td className="px-4 py-3">
                  <UserRowActions user={u} departments={departments ?? []} currentUserId={profile.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
