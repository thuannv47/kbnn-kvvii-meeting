import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canCreateMeeting, isBGD } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import CreateMeetingForm from '@/components/meetings/create-meeting-form';

export default async function CreateMeetingPage() {
  const { profile } = await requireUser();
  if (!canCreateMeeting(profile)) redirect('/dashboard'); // Lớp 1: chặn UI truy cập trang

  const supabase = createServerSupabase();
  const { data: departments } = await supabase.from('departments').select('*').eq('active', true).order('name');

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl mb-5">Tạo cuộc họp mới</h1>
      <CreateMeetingForm
        departments={departments ?? []}
        defaultDepartmentId={profile.department_id ?? ''}
        canPickAnyDepartment={isBGD(profile)}
      />
    </div>
  );
}
