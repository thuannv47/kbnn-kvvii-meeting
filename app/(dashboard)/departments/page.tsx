import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';
import DepartmentForm from '@/components/dashboard/department-form';
import DepartmentsTable from '@/components/dashboard/departments-table';

export default async function DepartmentsPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: departments } = await supabase.from('departments').select('*').order('name');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Phòng ban</h1>

      {canManageOrg(profile) && <DepartmentForm />}

      <DepartmentsTable departments={departments ?? []} />
    </div>
  );
}
