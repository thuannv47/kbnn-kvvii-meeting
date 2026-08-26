import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canCreateMeeting, isBGD } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import CreateMeetingForm from '@/components/meetings/create-meeting-form';

export default async function CreateMeetingPage() {
  const { profile } = await requireUser();
  if (!canCreateMeeting(profile)) redirect('/dashboard'); // Lớp 1: chặn UI truy cập trang

  const supabase = createServerSupabase();
<<<<<<< HEAD
  const [{ data: departments }, { data: users }] = await Promise.all([
    supabase.from('departments').select('*').eq('active', true).order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, position, department_id, departments:department_id(name)')
      .eq('active', true)
      .order('full_name')
  ]);
=======
  const { data: departments } = await supabase.from('departments').select('*').eq('active', true).order('name');
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl mb-5">Tạo cuộc họp mới</h1>
      <CreateMeetingForm
        departments={departments ?? []}
<<<<<<< HEAD
        users={users ?? []}
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
        defaultDepartmentId={profile.department_id ?? ''}
        canPickAnyDepartment={isBGD(profile)}
      />
    </div>
  );
}
