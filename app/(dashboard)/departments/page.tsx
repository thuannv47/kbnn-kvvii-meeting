import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import DepartmentForm from '@/components/dashboard/department-form';

const typeLabel: Record<string, string> = {
  HEAD_OFFICE: 'Hội sở',
  BRANCH: 'Chi nhánh / PGD'
};

export default async function DepartmentsPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: departments } = await supabase.from('departments').select('*').order('name');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Phòng ban</h1>

      {canManageOrg(profile) && <DepartmentForm />}

      <div className="table-wrap">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Loại</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(departments ?? []).map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-xs text-inksoft">{d.code}</td>
                <td className="font-medium">{d.name}</td>
                <td>{typeLabel[d.department_type] ?? d.department_type}</td>
                <td>
                  {d.active ? (
                    <span className="tag">Hoạt động</span>
                  ) : (
                    <span className="tag-muted">Ngừng</span>
                  )}
                </td>
              </tr>
            ))}
            {(!departments || departments.length === 0) && (
              <tr>
                <td colSpan={4} className="table-empty">
                  Chưa có phòng ban nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
