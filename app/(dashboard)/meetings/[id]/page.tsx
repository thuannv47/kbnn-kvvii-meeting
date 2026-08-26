import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canViewMeeting, canManageMeeting, canDeleteMeeting } from '@/lib/permissions';
import MeetingTabs from '@/components/meetings/meeting-tabs';

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  // RLS đã tự chặn ở tầng DB; select trả về null nếu không có quyền -> notFound()
  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', params.id).maybeSingle();
  if (!meeting) notFound();

  const { data: perms } = await supabase.from('meeting_departments').select('*').eq('meeting_id', params.id);
<<<<<<< HEAD
  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('*, profiles:user_id(full_name, position)')
    .eq('meeting_id', params.id);
  const { data: hostDept } = await supabase.from('departments').select('*').eq('id', meeting.host_department_id).single();

  if (!canViewMeeting(meeting as any, (perms ?? []) as any, profile, (participants ?? []) as any)) notFound();
=======
  const { data: hostDept } = await supabase.from('departments').select('*').eq('id', meeting.host_department_id).single();

  if (!canViewMeeting(meeting as any, (perms ?? []) as any, profile)) notFound();
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d

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

  return (
    <MeetingTabs
      meeting={meeting as any}
      hostDepartmentName={hostDept?.name}
      perms={(perms ?? []) as any}
<<<<<<< HEAD
      participants={(participants ?? []) as any}
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
      documents={(documents ?? []) as any}
      comments={(comments ?? []) as any}
      conclusion={(conclusion ?? null) as any}
      allDepartments={(allDepartments ?? []) as any}
      profile={profile}
      canManage={canManageMeeting(meeting as any, profile)}
      canDelete={canDeleteMeeting(meeting as any, profile)}
    />
  );
}
