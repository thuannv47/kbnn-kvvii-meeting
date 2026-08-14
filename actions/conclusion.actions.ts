'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { canDraftConclusion, canConfirmConclusion } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';

export async function draftConclusionAction(meetingId: string, content: string) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  if (!meeting || !canDraftConclusion(meeting as any, profile)) {
    return { error: 'Bạn không có quyền soạn kết luận cho cuộc họp này.' };
  }

  const { data: existing } = await supabase
    .from('meeting_conclusions')
    .select('*')
    .eq('meeting_id', meetingId)
    .maybeSingle();

  let conclusionId = existing?.id;

  if (existing) {
    await supabase.from('meeting_conclusions').update({ content }).eq('id', existing.id);
    await supabase.from('conclusion_versions').insert({
      conclusion_id: existing.id,
      content,
      edited_by: authId
    });
  } else {
    const { data: created, error } = await supabase
      .from('meeting_conclusions')
      .insert({ meeting_id: meetingId, content, created_by: authId, status: 'DRAFT' })
      .select()
      .single();
    if (error || !created) return { error: 'Không lưu được kết luận: ' + (error?.message ?? '') };
    conclusionId = created.id;
    await supabase.from('conclusion_versions').insert({ conclusion_id: created.id, content, edited_by: authId });
  }

  await logAudit({ userId: authId, action: 'DRAFT_CONCLUSION', entityType: 'conclusion', entityId: conclusionId, metadata: { meeting_id: meetingId } });
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

export async function confirmConclusionAction(meetingId: string) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: conclusion } = await supabase
    .from('meeting_conclusions')
    .select('*')
    .eq('meeting_id', meetingId)
    .maybeSingle();

  if (!canConfirmConclusion(conclusion as any, profile)) {
    return { error: 'Chỉ Ban Giám đốc mới có quyền xác nhận kết luận.' };
  }

  const { error } = await supabase
    .from('meeting_conclusions')
    .update({ status: 'CONFIRMED', confirmed_by: authId, confirmed_at: new Date().toISOString() })
    .eq('meeting_id', meetingId);

  if (error) return { error: error.message };

  await logAudit({ userId: authId, action: 'CONFIRM_CONCLUSION', entityType: 'conclusion', entityId: conclusion!.id, metadata: { meeting_id: meetingId } });
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}
