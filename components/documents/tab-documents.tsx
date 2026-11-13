'use client';

import { useState, useTransition } from 'react';
import type { Meeting, MeetingDepartment, MeetingParticipant } from '@/types/meeting';
import type { Profile } from '@/types/user';
import { canUploadDocument, canAddVersion, canDeleteDocument } from '@/lib/permissions';
import {
  requestDocumentUploadUrlAction,
  confirmDocumentUploadAction,
  requestDocumentVersionUploadUrlAction,
  confirmDocumentVersionAction,
  deleteDocumentAction
} from '@/actions/document.actions';
import MultiFilePicker, { fileKey, type FileStatus } from '@/components/ui/multi-file-picker';
import { runPool, putFileToStorage } from '@/lib/upload/run-pool';
import { formatFileSize as formatSize } from '@/lib/storage/constants';

/** Số file tải lên song song. 3 là mức vừa phải: nhanh hơn tuần tự mà không nghẽn mạng. */
const UPLOAD_CONCURRENCY = 3;

export default function TabDocuments({
  meeting,
  perms,
  participants = [],
  documents,
  profile
}: {
  meeting: Meeting;
  perms: MeetingDepartment[];
  participants?: MeetingParticipant[];
  documents: any[];
  profile: Profile;
}) {
  const canUpload = canUploadDocument(meeting, perms, profile, participants);
  const [files, setFiles] = useState<File[]>([]);
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  /** Bỏ phần đuôi mở rộng để dùng làm tiêu đề tài liệu, VD "Báo cáo.docx" -> "Báo cáo". */
  function titleFromFileName(fileName: string) {
    const withoutExt = fileName.replace(/\.[^./]+$/, '');
    return withoutExt.trim() || fileName;
  }

  function setStatus(key: string, st: FileStatus) {
    setStatuses((prev) => ({ ...prev, [key]: st }));
  }

  async function uploadOne(file: File): Promise<string | null> {
    const urlRes = await requestDocumentUploadUrlAction({
      meetingId: meeting.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream'
    });
    if (urlRes?.error || !urlRes?.data) return urlRes?.error ?? 'Không xin được URL tải lên.';

    await putFileToStorage(urlRes.data.uploadUrl, file);

    const res = await confirmDocumentUploadAction({
      meetingId: meeting.id,
      title: titleFromFileName(file.name),
      description: '',
      storagePath: urlRes.data.storagePath,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size
    });
    return res?.error ?? null;
  }

  async function handleUpload() {
    if (uploading) return;
    setError(null);
    if (files.length === 0) {
      setError('Vui lòng chọn ít nhất 1 file.');
      return;
    }

    const batch = [...files];
    setUploading(true);
    setProgress({ done: 0, total: batch.length });
    setStatuses(Object.fromEntries(batch.map((f) => [fileKey(f), { state: 'pending' } as FileStatus])));

    const succeeded = new Set<string>();
    let failedCount = 0;

    // Mỗi file thành 1 tài liệu riêng; một file lỗi KHÔNG làm dừng các file còn lại.
    await runPool(batch, UPLOAD_CONCURRENCY, async (file) => {
      const key = fileKey(file);
      setStatus(key, { state: 'uploading' });
      try {
        const err = await uploadOne(file);
        if (err) {
          failedCount++;
          setStatus(key, { state: 'error', message: err });
        } else {
          succeeded.add(key);
          setStatus(key, { state: 'done' });
        }
      } catch (e: any) {
        failedCount++;
        setStatus(key, { state: 'error', message: e?.message ?? 'Lỗi không xác định' });
      } finally {
        setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
      }
    });

    // Chỉ giữ lại các file LỖI trong danh sách để bấm "Tải lên" thử lại —
    // file đã lên thành công bị loại ra, nên thử lại sẽ không tạo tài liệu trùng.
    setFiles(batch.filter((f) => !succeeded.has(fileKey(f))));
    setStatuses((prev) => Object.fromEntries(Object.entries(prev).filter(([, v]) => v.state === 'error')));
    setProgress(null);
    setUploading(false);
    if (failedCount > 0) {
      setError(`${succeeded.size} file đã tải lên, ${failedCount} file lỗi (xem chi tiết bên dưới). Bấm "Tải lên" để thử lại các file lỗi.`);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="card p-4 space-y-2.5">
          <h3 className="font-semibold">Tải tài liệu lên</h3>
          <MultiFilePicker
            files={files}
            onChange={(f) => {
              setFiles(f);
              setError(null);
            }}
            statuses={statuses}
            disabled={uploading}
            onReject={(msgs) => msgs.length && setError(msgs.join(' · '))}
          />
          <p className="text-xs text-inksoft">
            Mỗi file sẽ thành 1 tài liệu riêng, tiêu đề lấy theo tên file. Chọn được nhiều lần, file được cộng dồn.
          </p>
          {progress && (
            <div>
              <div className="h-1.5 rounded bg-line overflow-hidden">
                <div
                  className="h-full bg-gold transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-inksoft mt-1">
                Đang tải lên {progress.done}/{progress.total} file…
              </p>
            </div>
          )}
          {error && <p className="text-red text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="btn-primary disabled:opacity-40"
          >
            {uploading ? 'Đang tải lên…' : files.length > 1 ? `Tải lên ${files.length} file` : 'Tải lên'}
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            canEdit={canAddVersion(meeting, doc, profile)}
            canDelete={canDeleteDocument(meeting, doc, profile)}
          />
        ))}
        {documents.length === 0 && <p className="text-sm text-inksoft">Chưa có tài liệu nào.</p>}
      </div>
    </div>
  );
}

function DocumentCard({
  doc,
  canEdit,
  canDelete
}: {
  doc: any;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const versions = [...(doc.document_versions ?? [])].sort((a, b) => b.version_number - a.version_number);

  const [versionError, setVersionError] = useState<string | null>(null);

  function handleAddVersion(formData: FormData) {
    setVersionError(null);
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      setVersionError('Vui lòng chọn file.');
      return;
    }

    startTransition(async () => {
      try {
        const urlRes = await requestDocumentVersionUploadUrlAction({
          documentId: doc.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream'
        });
        if (urlRes?.error || !urlRes?.data) {
          setVersionError(urlRes?.error ?? 'Không xin được URL tải lên.');
          return;
        }

        await putFileToStorage(urlRes.data.uploadUrl, file);

        const res = await confirmDocumentVersionAction({
          documentId: doc.id,
          storagePath: urlRes.data.storagePath,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          version: urlRes.data.nextVersion
        });
        if (res?.error) setVersionError(res.error);
      } catch (e: any) {
        setVersionError(e?.message ?? 'Tải phiên bản mới lên thất bại.');
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Xoá hẳn tài liệu "${doc.title}" (kèm toàn bộ version)? Không thể hoàn tác.`)) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteDocumentAction(doc.id);
      if (res?.error) setDeleteError(res.error);
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold">{doc.title}</h4>
          {doc.description && <p className="text-sm text-inksoft">{doc.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge bg-line text-inksoft">v{doc.current_version}</span>
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

      <div className="mt-2 space-y-1">
        {versions.map((v: any) => (
          <a
            key={v.id}
            href={`/api/download/document-version/${v.id}`}
            target="_blank"
            className="flex items-center justify-between text-sm text-gold hover:underline"
          >
            <span>
              📎 v{v.version_number} — {v.file_name}
            </span>
            <span className="text-inksoft">{formatSize(v.file_size)}</span>
          </a>
        ))}
      </div>

      {deleteError && <p className="text-red text-xs mt-2">{deleteError}</p>}

      {canEdit && (
        <div className="mt-3">
          <form action={handleAddVersion} className="flex gap-2 items-center">
            <input name="file" type="file" required className="input text-xs" />
            <button type="submit" disabled={isPending} className="btn text-xs whitespace-nowrap">
              {isPending ? 'Đang tải…' : '+ Version mới'}
            </button>
          </form>
          {versionError && <p className="text-red text-xs mt-1">{versionError}</p>}
        </div>
      )}
    </div>
  );
}
