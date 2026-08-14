import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import DepartmentForm from '@/components/dashboard/department-form';

export default async function DepartmentsPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: departments } = await supabase.from('departments').select('*').order('name');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Phòng ban</h1>

      {canManageOrg(profile) && <DepartmentForm />}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-inksoft border-b border-line">
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(departments ?? []).map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{d.code}</td>
                <td className="px-4 py-3">{d.name}</td>
                <td className="px-4 py-3">{d.department_type}</td>
                <td className="px-4 py-3">{d.active ? 'Hoạt động' : 'Ngừng'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
