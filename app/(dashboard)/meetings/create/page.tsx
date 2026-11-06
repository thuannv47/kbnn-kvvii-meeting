import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { canCreateMeeting, isBGD } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import CreateMeetingForm from '@/components/meetings/create-meeting-form';

export default async function CreateMeetingPage() {
  const { profile } = await requireUser();
  if (!canCreateMeeting(profile)) redirect('/dashboard'); // Lớp 1: chặn UI truy cập trang

  const supabase = createServerSupabase();

  // Danh sách NGƯỜI DỰ HỌP phải gồm người của MỌI phòng ban (người tạo thuộc 1
  // phòng chủ trì nhưng được mời người các phòng khác). Nếu query bằng client
  // thường thì RLS của bảng profiles chỉ trả về người cùng phòng, nên dùng
  // service-role ở server — chỉ lấy các cột tối thiểu để chọn người (không lấy
  // username/role), và chỉ chạy trong Server Component này nên không lộ ra client.
  const admin = createAdminSupabase();
  const [{ data: departments }, { data: usersRaw }] = await Promise.all([
    supabase.from('departments').select('*').eq('active', true).order('name'),
    admin
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
