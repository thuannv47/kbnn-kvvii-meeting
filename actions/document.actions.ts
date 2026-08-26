'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { canUploadDocument, canAddVersion, canDeleteDocument } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';
import { buildStoragePath, getUploadUrl, deleteFile, MAX_FILE_SIZE, ALLOWED_MIME } from '@/lib/storage/b2';

async function loadMeetingContext(supabase: ReturnType<typeof createServerSupabase>, meetingId: string) {
  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  const [{ data: perms }, { data: participants }] = await Promise.all([
    supabase.from('meeting_departments').select('*').eq('meeting_id', meetingId),
    supabase.from('meeting_participants').select('*').eq('meeting_id', meetingId)
  ]);
  return { meeting, perms: perms ?? [], participants: participants ?? [] };
}

function validateFileMeta(fileSize: number, mimeType: string) {
  if (fileSize > MAX_FILE_SIZE) return 'File vượt quá dung lượng cho phép (100MB).';
  if (ALLOWED_MIME.length && mimeType && !ALLOWED_MIME.includes(mimeType)) {
    return 'Định dạng file không được hỗ trợ.';
  }
  return null;
}

/**
 * BƯỚC 1 của upload tài liệu mới: kiểm tra quyền, sinh URL để trình duyệt PUT
 * file THẲNG lên Backblaze B2 (không đi qua Server Action, tránh giới hạn
 * 4.5MB của Vercel Functions). Chưa ghi gì vào DB ở bước này.
 */
export async function requestDocumentUploadUrlAction(input: {
  meetingId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  const metaError = validateFileMeta(input.fileSize, input.mimeType);
  if (metaError) return { error: metaError };

  const { meeting, perms, participants } = await loadMeetingContext(supabase, input.meetingId);
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };
  if (!canUploadDocument(meeting as any, perms as any, profile, participants as any)) {
    return { error: 'Bạn không có quyền tải tài liệu lên cuộc họp này.' };
  }

  const { data: dept } = await supabase
    .from('departments')
    .select('code')
    .eq('id', profile.department_id)
    .single();

  const storagePath = buildStoragePath({
    bucket: 'meeting-documents',
    meetingCode: meeting.code,
    departmentCode: dept?.code ?? 'UNKNOWN',
    version: 1,
    fileName: input.fileName
  });

  const uploadUrl = await getUploadUrl(storagePath, input.mimeType || 'application/octet-stream');
  return { data: { uploadUrl, storagePath } };
}

/**
 * BƯỚC 2: sau khi trình duyệt PUT file thành công lên B2, ghi metadata
 * (document + version 1) vào DB. Kiểm tra lại quyền lần nữa (fail-fast trước RLS).
 */
export async function confirmDocumentUploadAction(input: {
  meetingId: string;
  title: string;
  description: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const title = input.title.trim();
  if (!input.meetingId || !title || !input.storagePath) {
    return { error: 'Thiếu thông tin bắt buộc (tiêu đề / file).' };
  }

  const { meeting, perms, participants } = await loadMeetingContext(supabase, input.meetingId);
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };
  if (!canUploadDocument(meeting as any, perms as any, profile, participants as any)) {
    return { error: 'Bạn không có quyền tải tài liệu lên cuộc họp này.' };
  }

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      meeting_id: input.meetingId,
      title,
      description: input.description,
      owner_department_id: profile.department_id,
      uploaded_by: authId,
      current_version: 1
    })
    .select()
    .single();

  if (docErr || !doc) return { error: 'Không tạo được tài liệu: ' + (docErr?.message ?? '') };

  const { error: verErr } = await supabase.from('document_versions').insert({
    document_id: doc.id,
    version_number: 1,
    file_name: input.fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType || null,
    file_size: input.fileSize,
    uploaded_by: authId
  });
  if (verErr) return { error: verErr.message };

  await logAudit({
    userId: authId,
    action: 'UPLOAD_DOCUMENT',
    entityType: 'document',
    entityId: doc.id,
    metadata: { meeting_id: input.meetingId, file_name: input.fileName }
  });

  revalidatePath(`/meetings/${input.meetingId}`);
  return { data: doc };
}

/** BƯỚC 1 của thêm version mới cho tài liệu đã có: xin URL upload lên B2. */
export async function requestDocumentVersionUploadUrlAction(input: {
  documentId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  const metaError = validateFileMeta(input.fileSize, input.mimeType);
  if (metaError) return { error: metaError };

  const { data: doc } = await supabase.from('documents').select('*').eq('id', input.documentId).single();
  if (!doc) return { error: 'Không tìm thấy tài liệu.' };

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', doc.meeting_id).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canAddVersion(meeting as any, doc as any, profile)) {
    return {
      error:
        'Bạn không có quyền cập nhật phiên bản tài liệu này. Chỉ người tạo/chủ trì phòng họp mới được ' +
        'sửa nội dung khi cuộc họp còn ở trạng thái Nháp (ADMIN được bỏ qua giới hạn này).'
    };
  }

  const { data: dept } = await supabase.from('departments').select('code').eq('id', doc.owner_department_id).single();

  const nextVersion = doc.current_version + 1;
  const storagePath = buildStoragePath({
    bucket: 'meeting-documents',
    meetingCode: meeting?.code ?? 'UNKNOWN',
    departmentCode: dept?.code ?? 'UNKNOWN',
    version: nextVersion,
    fileName: input.fileName
  });

  const uploadUrl = await getUploadUrl(storagePath, input.mimeType || 'application/octet-stream');
  return { data: { uploadUrl, storagePath, nextVersion } };
}

/** BƯỚC 2: ghi version mới vào DB sau khi đã PUT file lên B2 thành công. */
export async function confirmDocumentVersionAction(input: {
  documentId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  version: number;
}) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: doc } = await supabase.from('documents').select('*').eq('id', input.documentId).single();
  if (!doc) return { error: 'Không tìm thấy tài liệu.' };

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', doc.meeting_id).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canAddVersion(meeting as any, doc as any, profile)) {
    return {
      error:
        'Bạn không có quyền cập nhật phiên bản tài liệu này. Chỉ người tạo/chủ trì phòng họp mới được ' +
        'sửa nội dung khi cuộc họp còn ở trạng thái Nháp (ADMIN được bỏ qua giới hạn này).'
    };
  }

  // Chặn race-condition: chỉ chấp nhận đúng version kế tiếp đã tính khi xin URL.
  if (input.version !== doc.current_version + 1) {
    return { error: 'Có người khác vừa cập nhật tài liệu này, vui lòng tải lại trang và thử lại.' };
  }

  const { error: verErr } = await supabase.from('document_versions').insert({
    document_id: input.documentId,
    version_number: input.version,
    file_name: input.fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType || null,
    file_size: input.fileSize,
    uploaded_by: authId
  });
  if (verErr) return { error: verErr.message };

  await supabase.from('documents').update({ current_version: input.version }).eq('id', input.documentId);

  await logAudit({
    userId: authId,
    action: 'ADD_DOCUMENT_VERSION',
    entityType: 'document',
    entityId: input.documentId,
    metadata: { version: input.version }
  });

  revalidatePath(`/meetings/${doc.meeting_id}`);
  return { success: true };
}

/**
 * Xoá hẳn một tài liệu (kèm mọi version + file trên B2).
 * Quyền hạn: xem canEditMeetingContent — chỉ ADMIN, hoặc người tạo/chủ trì phòng họp
 * khi cuộc họp còn ở trạng thái Nháp (DRAFT).
 */
export async function deleteDocumentAction(documentId: string) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_versions(*)')
    .eq('id', documentId)
    .single();
  if (!doc) return { error: 'Không tìm thấy tài liệu.' };

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', doc.meeting_id).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canDeleteDocument(meeting as any, doc as any, profile)) {
    return {
      error:
        'Bạn không có quyền xoá tài liệu này. Chỉ người tạo/chủ trì phòng họp mới được xoá nội dung ' +
        'khi cuộc họp còn ở trạng thái Nháp (ADMIN được bỏ qua giới hạn này).'
    };
  }

  const { error } = await supabase.from('documents').delete().eq('id', documentId);
  if (error) return { error: 'Không xoá được tài liệu: ' + error.message };

  // Dọn file trên B2 cho tất cả version (best-effort, không chặn nếu lỗi).
  for (const v of (doc as any).document_versions ?? []) {
    if (v.storage_path) {
      await deleteFile(v.storage_path).catch(() => {});
    }
  }

  await logAudit({
    userId: authId,
    action: 'DELETE_DOCUMENT',
    entityType: 'document',
    entityId: documentId,
    metadata: { meeting_id: doc.meeting_id, title: doc.title }
  });

  revalidatePath(`/meetings/${doc.meeting_id}`);
  return { success: true };
}
