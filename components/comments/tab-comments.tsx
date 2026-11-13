'use client';

import { useRef, useState, useTransition } from 'react';
import type { Meeting, MeetingDepartment, MeetingParticipant } from '@/types/meeting';
import type { Profile } from '@/types/user';
import { canCommentMeeting, canDeleteComment } from '@/lib/permissions';
import { addCommentAction, deleteCommentAction, requestCommentAttachmentUploadUrlAction } from '@/actions/comment.actions';
import MultiFilePicker, { fileKey, type FileStatus } from '@/components/ui/multi-file-picker';
import { runPool, putFileToStorage } from '@/lib/upload/run-pool';
import { MAX_ATTACHMENTS_PER_COMMENT } from '@/lib/storage/constants';

type UploadedAttachment = { storagePath: string; fileName: string; mimeType: string; fileSize: number };

export default function TabComments({
  meeting,
  perms,
  participants = [],
  comments,
  profile
}: {
  meeting: Meeting;
  perms: MeetingDepartment[];
  participants?: MeetingParticipant[];
  comments: any[];
  profile: Profile;
}) {
  const canComment = canCommentMeeting(meeting, perms, profile, participants);
  const canDelete = canDeleteComment(meeting, profile);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});
  // Nhớ các file ĐÃ lên B2 thành công: nếu gửi lỗi giữa chừng, bấm gửi lại sẽ không tải lên lần nữa.
  const uploadedRef = useRef<Map<string, UploadedAttachment>>(new Map());

  function setStatus(key: string, st: FileStatus) {
    setStatuses((prev) => ({ ...prev, [key]: st }));
  }

  function submit() {
    setError(null);
    const text = content.trim();
    if (!text && files.length === 0) {
      setError('Vui lòng nhập ý kiến hoặc đính kèm file.');
      return;
    }

    startTransition(async () => {
      try {
        // 1) Tải các file chưa lên (song song 3 file) THẲNG lên B2.
        const todo = files.filter((f) => !uploadedRef.current.has(fileKey(f)));
        let failed = 0;
        await runPool(todo, 3, async (file) => {
          const key = fileKey(file);
          setStatus(key, { state: 'uploading' });
          try {
            const urlRes = await requestCommentAttachmentUploadUrlAction({
              meetingId: meeting.id,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || 'application/octet-stream'
            });
            if (urlRes?.error || !urlRes?.data) throw new Error(urlRes?.error ?? 'Không xin được URL tải lên.');
            await putFileToStorage(urlRes.data.uploadUrl, file);
            uploadedRef.current.set(key, {
              storagePath: urlRes.data.storagePath,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileSize: file.size
            });
            setStatus(key, { state: 'done' });
          } catch (e: any) {
            failed++;
            setStatus(key, { state: 'error', message: e?.message ?? 'Tải file thất bại.' });
          }
        });

        // Có file lỗi thì CHƯA gửi ý kiến, để người dùng xử lý (bỏ file lỗi hoặc thử lại).
        if (failed > 0) {
          setError(`${failed} file tải lên lỗi. Hãy bỏ file lỗi hoặc bấm "Gửi ý kiến" để thử lại.`);
          return;
        }

        // 2) Gửi ý kiến kèm danh sách metadata các file.
        const attachments = files.map((f) => uploadedRef.current.get(fileKey(f))!).filter(Boolean);
        const payload = new FormData();
        payload.set('meeting_id', meeting.id);
        payload.set('content', text);
        payload.set('attachments', JSON.stringify(attachments));

        const res = await addCommentAction(payload);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setContent('');
        setFiles([]);
        setStatuses({});
        uploadedRef.current.clear();
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
        <div className="card p-4 space-y-2.5">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Nhập ý kiến của bạn…"
            className="input"
          />
          <MultiFilePicker
            files={files}
            onChange={(f) => {
              setFiles(f);
              setError(null);
            }}
            statuses={statuses}
            disabled={isPending}
            maxFiles={MAX_ATTACHMENTS_PER_COMMENT}
            onReject={(msgs) => msgs.length && setError(msgs.join(' · '))}
          />
          {error && <p className="text-red text-sm">{error}</p>}
          <button type="button" onClick={submit} disabled={isPending} className="btn-primary">
            {isPending ? 'Đang gửi…' : 'Gửi ý kiến'}
          </button>
        </div>
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
