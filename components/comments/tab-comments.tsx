'use client';

import { useRef, useState, useTransition } from 'react';
import type { Meeting, MeetingDepartment } from '@/types/meeting';
import type { Profile } from '@/types/user';
import { canCommentMeeting, canDeleteComment } from '@/lib/permissions';
import { addCommentAction, deleteCommentAction, requestCommentAttachmentUploadUrlAction } from '@/actions/comment.actions';

export default function TabComments({
  meeting,
  perms,
  comments,
  profile
}: {
  meeting: Meeting;
  perms: MeetingDepartment[];
  comments: any[];
  profile: Profile;
}) {
  const canComment = canCommentMeeting(meeting, perms, profile);
  const canDelete = canDeleteComment(meeting, profile);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    const content = String(formData.get('content') || '').trim();
    const file = formData.get('file') as File | null;
    if (!content && (!file || file.size === 0)) {
      setError('Vui lòng nhập ý kiến hoặc đính kèm file.');
      return;
    }

    startTransition(async () => {
      try {
        const payload = new FormData();
        payload.set('meeting_id', meeting.id);
        payload.set('content', content);

        // Có file đính kèm: PUT thẳng lên B2 trước (không qua Server Action)
        // rồi mới gửi metadata kèm ý kiến.
        if (file && file.size > 0) {
          const urlRes = await requestCommentAttachmentUploadUrlAction({
            meetingId: meeting.id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream'
          });
          if (urlRes?.error || !urlRes?.data) {
            setError(urlRes?.error ?? 'Không xin được URL tải lên.');
            return;
          }

          const putRes = await fetch(urlRes.data.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file
          });
          if (!putRes.ok) {
            setError('Tải file lên kho lưu trữ thất bại.');
            return;
          }

          payload.set('storage_path', urlRes.data.storagePath);
          payload.set('file_name', file.name);
          payload.set('mime_type', file.type || 'application/octet-stream');
          payload.set('file_size', String(file.size));
        }

        const res = await addCommentAction(payload);
        if (res?.error) setError(res.error);
        else formRef.current?.reset();
      } catch (e: any) {
        setError(e?.message ?? 'Gửi ý kiến thất bại.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.map((c) => (
          <CommentCard key={c.id} comment={c} canDelete={canDelete} />
        ))}
        {comments.length === 0 && <p className="text-sm text-inksoft">Chưa có ý kiến nào.</p>}
      </div>

      {canComment && (
        <form ref={formRef} action={submit} className="card p-4 space-y-2.5">
          <textarea name="content" rows={3} placeholder="Nhập ý kiến của bạn…" className="input" />
          <input name="file" type="file" className="input" />
          {error && <p className="text-red text-sm">{error}</p>}
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Đang gửi…' : 'Gửi ý kiến'}
          </button>
        </form>
      )}
    </div>
  );
}

function CommentCard({ comment: c, canDelete }: { comment: any; canDelete: boolean }) {
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm('Xoá hẳn ý kiến này (kèm tệp đính kèm nếu có)? Không thể hoàn tác.')) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteCommentAction(c.id);
      if (res?.error) setDeleteError(res.error);
    });
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold">{c.profiles?.full_name ?? 'Người dùng'}</span>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-inksoft">{new Date(c.created_at).toLocaleString('vi-VN')}</span>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs underline text-red disabled:opacity-40"
            >
              {isDeleting ? 'Đang xoá…' : 'Xoá'}
            </button>
          )}
        </div>
      </div>
      {c.content && <p className="text-sm whitespace-pre-wrap">{c.content}</p>}
      {(c.comment_attachments ?? []).map((a: any) => (
        <a
          key={a.id}
          href={`/api/download/comment-attachment/${a.id}`}
          target="_blank"
          className="block text-sm text-gold hover:underline mt-1"
        >
          📎 {a.file_name}
        </a>
      ))}
      {deleteError && <p className="text-red text-xs mt-1">{deleteError}</p>}
    </div>
  );
}
