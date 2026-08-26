'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { canCommentMeeting, canDeleteComment } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';
import { buildStoragePath, getUploadUrl, deleteFile, MAX_FILE_SIZE, ALLOWED_MIME } from '@/lib/storage/b2';

/**
 * Xin URL để trình duyệt PUT tệp đính kèm ý kiến THẲNG lên B2 (tránh giới hạn
 * 4.5MB của Vercel Functions). Gọi trước khi gửi ý kiến nếu có chọn file.
 */
export async function requestCommentAttachmentUploadUrlAction(input: {
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
  const { data: perms } = await supabase.from('meeting_departments').select('*').eq('meeting_id', input.meetingId);
<<<<<<< HEAD
  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('*')
    .eq('meeting_id', input.meetingId);
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canCommentMeeting(meeting as any, (perms ?? []) as any, profile, (participants ?? []) as any)) {
=======
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canCommentMeeting(meeting as any, (perms ?? []) as any, profile)) {
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
    return { error: 'Bạn không có quyền tham gia ý kiến cho cuộc họp này.' };
  }

  const storagePath = buildStoragePath({
    bucket: 'meeting-comments',
    meetingCode: meeting.code,
    departmentCode: 'ATTACH',
    version: 1,
    fileName: input.fileName
  });

  const uploadUrl = await getUploadUrl(storagePath, input.mimeType || 'application/octet-stream');
  return { data: { uploadUrl, storagePath } };
}

export async function addCommentAction(formData: FormData) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const meetingId = String(formData.get('meeting_id'));
  const content = String(formData.get('content') || '').trim();
  // Nếu có file đính kèm, trình duyệt đã PUT thẳng lên B2 trước đó (xem
  // requestCommentAttachmentUploadUrlAction) — ở đây chỉ nhận lại metadata.
  const storagePath = String(formData.get('storage_path') || '');
  const fileName = String(formData.get('file_name') || '');
  const mimeType = String(formData.get('mime_type') || '');
  const fileSize = Number(formData.get('file_size') || 0);

  if (!meetingId || (!content && !storagePath)) {
    return { error: 'Vui lòng nhập ý kiến hoặc đính kèm file.' };
  }

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  const { data: perms } = await supabase.from('meeting_departments').select('*').eq('meeting_id', meetingId);
<<<<<<< HEAD
  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('*')
    .eq('meeting_id', meetingId);
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canCommentMeeting(meeting as any, (perms ?? []) as any, profile, (participants ?? []) as any)) {
=======
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canCommentMeeting(meeting as any, (perms ?? []) as any, profile)) {
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
    return { error: 'Bạn không có quyền tham gia ý kiến cho cuộc họp này.' };
  }

  const { data: comment, error } = await supabase
    .from('meeting_comments')
    .insert({
      meeting_id: meetingId,
      department_id: profile.department_id,
      user_id: authId,
      content
    })
    .select()
    .single();

  if (error || !comment) return { error: 'Không gửi được ý kiến: ' + (error?.message ?? '') };

  if (storagePath) {
    await supabase.from('comment_attachments').insert({
      comment_id: comment.id,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: mimeType || null,
      file_size: fileSize || null
    });
  }

  await logAudit({ userId: authId, action: 'ADD_COMMENT', entityType: 'comment', entityId: comment.id, metadata: { meeting_id: meetingId } });

  revalidatePath(`/meetings/${meetingId}`);
  return { data: comment };
}

/**
 * Xoá hẳn một ý kiến (kèm tệp đính kèm + file trên B2, nếu có).
 * Quyền hạn: chỉ ADMIN, hoặc người tạo/chủ trì phòng họp khi cuộc họp còn ở
 * trạng thái Nháp (DRAFT) — xem canDeleteComment trong lib/permissions.
 */
export async function deleteCommentAction(commentId: string) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: comment } = await supabase
    .from('meeting_comments')
    .select('*, comment_attachments(*)')
    .eq('id', commentId)
    .single();
  if (!comment) return { error: 'Không tìm thấy ý kiến.' };

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', comment.meeting_id).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canDeleteComment(meeting as any, profile)) {
    return {
      error:
        'Bạn không có quyền xoá ý kiến/tệp đính kèm này. Chỉ người tạo/chủ trì phòng họp mới được xoá ' +
        'nội dung khi cuộc họp còn ở trạng thái Nháp (ADMIN được bỏ qua giới hạn này).'
    };
  }

  const { error } = await supabase.from('meeting_comments').delete().eq('id', commentId);
  if (error) return { error: 'Không xoá được ý kiến: ' + error.message };

  for (const a of (comment as any).comment_attachments ?? []) {
    if (a.storage_path) {
      await deleteFile(a.storage_path).catch(() => {});
    }
  }

  await logAudit({
    userId: authId,
    action: 'DELETE_COMMENT',
    entityType: 'comment',
    entityId: commentId,
    metadata: { meeting_id: comment.meeting_id }
  });

  revalidatePath(`/meetings/${comment.meeting_id}`);
  return { success: true };
}
