import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getDownloadUrl } from '@/lib/storage/b2';
import { logAudit } from '@/lib/audit/log';

/**
 * URL dạng: /api/download/document-version/<id>  hoặc /api/download/comment-attachment/<id>
 * Route KHÔNG public — luôn truy vấn qua Supabase (bị RLS chi phối) để xác nhận
 * người dùng hiện tại có quyền xem, SAU ĐÓ redirect (302) sang 1 URL ký sẵn
 * (presigned URL) của Backblaze B2 để trình duyệt tải trực tiếp từ đó.
 * KHÔNG đọc file qua route handler nữa vì Vercel Functions giới hạn response
 * body ở mức 4.5MB — không đủ cho tài liệu lớn.
 */
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const [kind, id] = params.path;
  const supabase = createServerSupabase();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  if (kind === 'document-version') {
    // RLS trên document_versions sẽ tự trả về rỗng nếu không có quyền xem
    const { data: version } = await supabase
      .from('document_versions')
      .select('*, documents!inner(meeting_id)')
      .eq('id', id)
      .maybeSingle();

    if (!version) return NextResponse.json({ error: 'Không tìm thấy hoặc không có quyền' }, { status: 404 });

    const url = await getDownloadUrl(version.storage_path, version.file_name, version.mime_type);
    await logAudit({
      userId: user.id,
      action: 'VIEW_DOCUMENT',
      entityType: 'document_version',
      entityId: id,
      metadata: { file_name: version.file_name }
    });

    return NextResponse.redirect(url);
  }

  if (kind === 'conclusion') {
    // RLS trên meeting_conclusions (policy "conclusion_select") tự chặn nếu
    // user không có quyền xem cuộc họp tương ứng.
    const { data: conclusion } = await supabase
      .from('meeting_conclusions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!conclusion || !conclusion.storage_path) {
      return NextResponse.json({ error: 'Không tìm thấy hoặc không có quyền' }, { status: 404 });
    }

    const url = await getDownloadUrl(conclusion.storage_path, conclusion.file_name ?? 'ket-luan', conclusion.mime_type);
    await logAudit({
      userId: user.id,
      action: 'VIEW_CONCLUSION_FILE',
      entityType: 'conclusion',
      entityId: id,
      metadata: { file_name: conclusion.file_name }
    });

    return NextResponse.redirect(url);
  }

  if (kind === 'comment-attachment') {
    const { data: attachment } = await supabase
      .from('comment_attachments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!attachment) return NextResponse.json({ error: 'Không tìm thấy hoặc không có quyền' }, { status: 404 });

    const url = await getDownloadUrl(attachment.storage_path, attachment.file_name, attachment.mime_type);
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ error: 'Loại tài nguyên không hợp lệ' }, { status: 400 });
}
