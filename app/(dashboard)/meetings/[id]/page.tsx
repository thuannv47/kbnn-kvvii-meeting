import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canViewMeeting, canManageMeeting, canDeleteMeeting, canDeleteMeetingAsThuky } from '@/lib/permissions';
import { createAdminSupabase } from '@/lib/supabase/admin';
import MeetingTabs from '@/components/meetings/meeting-tabs';

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  // RLS đã tự chặn ở tầng DB; select trả về null nếu không có quyền -> notFound()
  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', params.id).maybeSingle();
  if (!meeting) notFound();

  const { data: perms } = await supabase.from('meeting_departments').select('*').eq('meeting_id', params.id);
  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('*, profiles:user_id(full_name, position)')
    .eq('meeting_id', params.id);
  const { data: hostDept } = await supabase.from('departments').select('*').eq('id', meeting.host_department_id).single();

  if (!canViewMeeting(meeting as any, (perms ?? []) as any, profile, (participants ?? []) as any)) notFound();

  const [{ data: documents }, { data: comments }, { data: conclusion }, { data: allDepartments }] =
    await Promise.all([
      supabase
        .from('documents')
        .select('*, document_versions(*)')
        .eq('meeting_id', params.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('meeting_comments')
        .select('*, profiles:user_id(full_name), comment_attachments(*)')
        .eq('meeting_id', params.id)
        .order('created_at', { ascending: true }),
      supabase.from('meeting_conclusions').select('*').eq('meeting_id', params.id).maybeSingle(),
      supabase.from('departments').select('*').eq('active', true).order('name')
    ]);

  const canManage = canManageMeeting(meeting as any, profile);

  // Danh sách người dùng để thêm/bớt người tham dự khi SỬA cuộc họp. RLS của bảng profiles chỉ cho
  // Trưởng phòng/Chuyên viên thấy người cùng phòng, nên dùng service role — chỉ tải khi người xem
  // đã được xác nhận có quyền quản lý cuộc họp này, và chỉ lấy các cột cần cho việc chọn người.
  let allUsers: any[] = [];
  if (canManage && meeting.status !== 'ARCHIVED') {
    const { data: usersRaw } = await createAdminSupabase()
      .from('profiles')
      .select('id, full_name, position, department_id, departments:department_id(name)')
      .eq('active', true)
      .order('full_name');
    allUsers = (usersRaw ?? []).map((u: any) => ({
      ...u,
      departments: Array.isArray(u.departments) ? (u.departments[0] ?? null) : u.departments
    }));
  }

  return (
    <MeetingTabs
      meeting={meeting as any}
      hostDepartmentName={hostDept?.name}
      perms={(perms ?? []) as any}
      participants={(participants ?? []) as any}
      documents={(documents ?? []) as any}
      comments={(comments ?? []) as any}
      conclusion={(conclusion ?? null) as any}
      allDepartments={(allDepartments ?? []) as any}
      allUsers={allUsers}
      profile={profile}
      canManage={canManage}
      canDelete={canDeleteMeeting(meeting as any, profile)}
      canDeleteAsThuky={canDeleteMeetingAsThuky(meeting as any, profile)}
    />
  );
}
