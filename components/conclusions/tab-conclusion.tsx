'use client';

import { useRef, useState, useTransition } from 'react';
import type { Meeting, MeetingConclusion } from '@/types/meeting';
import type { Profile } from '@/types/user';
import { canDraftConclusion, canConfirmConclusion } from '@/lib/permissions';
import {
  draftConclusionAction,
  confirmConclusionAction,
  requestConclusionAttachmentUploadUrlAction,
  confirmConclusionAttachmentAction,
  removeConclusionAttachmentAction
} from '@/actions/conclusion.actions';

/** PUT file thẳng lên B2 bằng URL đã ký (không đi qua Vercel Function). */
async function putFileToStorage(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });
  if (!res.ok) throw new Error('Tải file lên kho lưu trữ thất bại.');
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export default function TabConclusion({
  meeting,
  conclusion,
  profile,
  canManage
}: {
  meeting: Meeting;
  conclusion: MeetingConclusion | null;
  profile: Profile;
  canManage: boolean;
}) {
  const [content, setContent] = useState(conclusion?.content ?? '');
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [isUploading, startUpload] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canDraft = canDraftConclusion(meeting, profile);
  const canConfirm = canConfirmConclusion(conclusion, profile);
  const isConfirmed = conclusion?.status === 'CONFIRMED';
  const hasFile = !!conclusion?.storage_path;

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await draftConclusionAction(meeting.id, content);
      setMsg(res?.error ?? 'Đã lưu bản nháp kết luận.');
    });
  }

  function confirmConclusion() {
    setMsg(null);
    startTransition(async () => {
      const res = await confirmConclusionAction(meeting.id);
      setMsg(res?.error ?? 'Đã xác nhận kết luận.');
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    startUpload(async () => {
      try {
        const urlRes = await requestConclusionAttachmentUploadUrlAction({
          meetingId: meeting.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream'
        });
        if (urlRes?.error || !urlRes?.data) {
          setFileError(urlRes?.error ?? 'Không xin được URL tải lên.');
          return;
        }

        await putFileToStorage(urlRes.data.uploadUrl, file);

        const res = await confirmConclusionAttachmentAction({
          meetingId: meeting.id,
          storagePath: urlRes.data.storagePath,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size
        });
        if (res?.error) setFileError(res.error);
      } catch (e: any) {
        setFileError(e?.message ?? 'Tải file kết luận lên thất bại.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  }

  function handleRemoveFile() {
    if (!window.confirm('Xoá file kết luận đã đính kèm? Không thể hoàn tác.')) return;
    setFileError(null);
    startRemove(async () => {
      const res = await removeConclusionAttachmentAction(meeting.id);
      if (res?.error) setFileError(res.error);
    });
  }

  if (!conclusion && !canDraft) {
    return <p className="text-sm text-inksoft">Chưa có kết luận cho cuộc họp này.</p>;
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Kết luận cuộc họp</h3>
        <span className={`badge ${isConfirmed ? 'bg-green text-white' : 'bg-line text-inksoft'}`}>
          {isConfirmed ? 'Đã xác nhận' : 'Bản nháp'}
        </span>
      </div>

      {/* Nội dung kết luận dạng text (tuỳ chọn — có thể dùng riêng hoặc kèm file) */}
      {canDraft && !isConfirmed ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="input"
          placeholder="Nhập nội dung kết luận cuộc họp…"
        />
      ) : (
        conclusion?.content && <p className="text-sm whitespace-pre-wrap">{conclusion.content}</p>
      )}

      {/* File kết luận chính thức (văn bản có chữ ký, biên bản scan, PDF…) do
          chủ trì / Ban Giám đốc tải lên — khác với ô nội dung text ở trên. */}
      <div className="border-t border-line pt-3 space-y-2">
        <h4 className="text-sm font-semibold text-inksoft">Văn bản kết luận đính kèm</h4>

        {hasFile ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <a
              href={`/api/download/conclusion/${conclusion!.id}`}
              target="_blank"
              className="flex items-center gap-2 text-gold hover:underline"
            >
              📎 {conclusion!.file_name}
              <span className="text-inksoft">{formatSize(conclusion!.file_size)}</span>
            </a>
            {canDraft && !isConfirmed && (
              <button
                onClick={handleRemoveFile}
                disabled={isRemoving}
                className="text-xs underline text-red disabled:opacity-40"
              >
                {isRemoving ? 'Đang xoá…' : 'Xoá file'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-inksoft">Chưa có file đính kèm.</p>
        )}

        {canDraft && !isConfirmed && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={isUploading}
              className="input text-xs"
            />
            {isUploading && <p className="text-xs text-inksoft mt-1">Đang tải file lên…</p>}
            {hasFile && !isUploading && (
              <p className="text-xs text-inksoft mt-1">Chọn file khác để thay thế file hiện tại.</p>
            )}
          </div>
        )}
        {fileError && <p className="text-red text-xs">{fileError}</p>}
      </div>

      {msg && <p className="text-sm text-inksoft">{msg}</p>}

      <div className="flex gap-2">
        {canDraft && !isConfirmed && (
          <button onClick={save} disabled={isPending} className="btn">
            Lưu bản nháp
          </button>
        )}
        {canConfirm && (
          <button onClick={confirmConclusion} disabled={isPending} className="btn-primary">
            Xác nhận kết luận (BGĐ)
          </button>
        )}
      </div>
    </div>
  );
}
