import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canCreateMeeting, isBGD } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import CreateMeetingForm from '@/components/meetings/create-meeting-form';

export default async function CreateMeetingPage() {
  const { profile } = await requireUser();
  if (!canCreateMeeting(profile)) redirect('/dashboard'); // Lớp 1: chặn UI truy cập trang

  const supabase = createServerSupabase();
  const [{ data: departments }, { data: usersRaw }] = await Promise.all([
    supabase.from('departments').select('*').eq('active', true).order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, position, department_id, departments:department_id(name)')
      .eq('active', true)
      .order('full_name')
  ]);

  // Supabase trả `departments` (quan hệ foreign key) dạng mảng dù chỉ có 1 dòng liên kết —
  // chuẩn hoá về object đơn (hoặc null) để khớp với type PickableUser ở form.
  const users = (usersRaw ?? []).map((u) => ({
    ...u,
    departments: Array.isArray(u.departments) ? (u.departments[0] ?? null) : u.departments
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl mb-5">Tạo cuộc họp mới</h1>
      <CreateMeetingForm
        departments={departments ?? []}
        users={users}
        defaultDepartmentId={profile.department_id ?? ''}
        canPickAnyDepartment={isBGD(profile)}
      />
    </div>
  );
}
