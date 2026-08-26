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

      <div className="table-wrap">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Tên đăng nhập</th>
              <th>Phòng ban</th>
              <th>Vai trò</th>
              <th>Chức danh</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: any) => (
              <tr key={u.id}>
                <td className="font-medium">{u.full_name}</td>
                <td className="font-mono text-xs text-inksoft">{u.username}</td>
                <td>{u.departments?.name}</td>
                <td>
                  <RoleBadge role={u.role} />
                </td>
                <td>{u.position}</td>
                <td>
                  {u.active ? <span className="tag">Hoạt động</span> : <span className="tag-muted">Ngừng</span>}
                </td>
                <td>
                  <UserRowActions user={u} departments={departments ?? []} currentUserId={profile.id} />
                </td>
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr>
                <td colSpan={7} className="table-empty">
                  Chưa có người dùng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
