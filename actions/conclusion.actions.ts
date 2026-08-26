'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { canDraftConclusion, canConfirmConclusion } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';
import { buildStoragePath, getUploadUrl, deleteFile, MAX_FILE_SIZE, ALLOWED_MIME } from '@/lib/storage/b2';

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

/**
 * ĐÍNH KÈM FILE KẾT LUẬN — dành cho chủ trì / người tạo cuộc họp / ADMIN
 * (đúng quyền canDraftConclusion, giống như soạn nội dung text).
 * Đây là văn bản kết luận chính thức (vd: scan có chữ ký, biên bản PDF…),
 * khác với ô nội dung text — có thể dùng riêng hoặc kèm theo cả hai.
 *
 * BƯỚC 1: xin URL để trình duyệt PUT file thẳng lên B2 (không qua Server Action,
 * tránh giới hạn 4.5MB của Vercel Functions — xem lib/storage/b2.ts).
 */
export async function requestConclusionAttachmentUploadUrlAction(input: {
  meetingId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  if (input.fileSize > MAX_FILE_SIZE) return { error: 'File vượt quá dung lượng cho phép (100MB).' };
  if (ALLOWED_MIME.length && input.mimeType && !ALLOWED_MIME.includes(input.mimeType)) {
    return { error: 'Định dạng file không được hỗ trợ.' };
  }

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', input.meetingId).single();
  if (!meeting || !canDraftConclusion(meeting as any, profile)) {
    return { error: 'Bạn không có quyền đính kèm file kết luận cho cuộc họp này.' };
  }

  const { data: existing } = await supabase
    .from('meeting_conclusions')
    .select('status')
    .eq('meeting_id', input.meetingId)
    .maybeSingle();
  if (existing?.status === 'CONFIRMED') {
    return { error: 'Kết luận đã được Ban Giám đốc xác nhận, không thể thay đổi file đính kèm.' };
  }

  const { data: dept } = await supabase
    .from('departments')
    .select('code')
    .eq('id', profile.department_id)
    .single();

  const storagePath = buildStoragePath({
    bucket: 'meeting-conclusions',
    meetingCode: meeting.code,
    departmentCode: dept?.code ?? 'UNKNOWN',
    version: 1,
    fileName: input.fileName
  });

  const uploadUrl = await getUploadUrl(storagePath, input.mimeType || 'application/octet-stream');
  return { data: { uploadUrl, storagePath } };
}

/** BƯỚC 2: sau khi PUT file lên B2 thành công, ghi metadata vào meeting_conclusions. */
export async function confirmConclusionAttachmentAction(input: {
  meetingId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', input.meetingId).single();
  if (!meeting || !canDraftConclusion(meeting as any, profile)) {
    return { error: 'Bạn không có quyền đính kèm file kết luận cho cuộc họp này.' };
  }

  const { data: existing } = await supabase
    .from('meeting_conclusions')
    .select('*')
    .eq('meeting_id', input.meetingId)
    .maybeSingle();
  if (existing?.status === 'CONFIRMED') {
    return { error: 'Kết luận đã được Ban Giám đốc xác nhận, không thể thay đổi file đính kèm.' };
  }

  const oldPath = existing?.storage_path;
  let conclusionId = existing?.id;

  const attachmentFields = {
    file_name: input.fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType || null,
    file_size: input.fileSize,
    attached_by: authId,
    attached_at: new Date().toISOString()
  };

  if (existing) {
    const { error } = await supabase.from('meeting_conclusions').update(attachmentFields).eq('id', existing.id);
    if (error) return { error: 'Không lưu được file kết luận: ' + error.message };
  } else {
    const { data: created, error } = await supabase
      .from('meeting_conclusions')
      .insert({ meeting_id: input.meetingId, created_by: authId, status: 'DRAFT', ...attachmentFields })
      .select()
      .single();
    if (error || !created) return { error: 'Không tạo được kết luận: ' + (error?.message ?? '') };
    conclusionId = created.id;
  }

  // Thay file mới thì dọn file cũ trên B2 (best-effort, không chặn nếu lỗi).
  if (oldPath && oldPath !== input.storagePath) {
    await deleteFile(oldPath).catch(() => {});
  }

  await logAudit({
    userId: authId,
    action: 'ATTACH_CONCLUSION_FILE',
    entityType: 'conclusion',
    entityId: conclusionId,
    metadata: { meeting_id: input.meetingId, file_name: input.fileName }
  });
  revalidatePath(`/meetings/${input.meetingId}`);
  return { success: true };
}

/** Gỡ file kết luận đã đính kèm (không xoá nội dung text, nếu có). */
export async function removeConclusionAttachmentAction(meetingId: string) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  if (!meeting || !canDraftConclusion(meeting as any, profile)) {
    return { error: 'Bạn không có quyền xoá file kết luận của cuộc họp này.' };
  }

  const { data: existing } = await supabase
    .from('meeting_conclusions')
    .select('*')
    .eq('meeting_id', meetingId)
    .maybeSingle();
  if (!existing || !existing.storage_path) return { error: 'Chưa có file kết luận nào để xoá.' };
  if (existing.status === 'CONFIRMED') {
    return { error: 'Kết luận đã được Ban Giám đốc xác nhận, không thể xoá file đính kèm.' };
  }

  const { error } = await supabase
    .from('meeting_conclusions')
    .update({ file_name: null, storage_path: null, mime_type: null, file_size: null, attached_by: null, attached_at: null })
    .eq('id', existing.id);
  if (error) return { error: error.message };

  await deleteFile(existing.storage_path).catch(() => {});

  await logAudit({
    userId: authId,
    action: 'REMOVE_CONCLUSION_FILE',
    entityType: 'conclusion',
    entityId: existing.id,
    metadata: { meeting_id: meetingId }
  });
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}
