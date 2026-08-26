'use client';

import { useRef, useState, useTransition } from 'react';
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    const file = formData.get('file') as File | null;
    const title = String(formData.get('title') || '');
    const description = String(formData.get('description') || '');
    if (!file || file.size === 0) {
      setError('Vui lòng chọn file.');
      return;
    }

    startTransition(async () => {
      try {
        const urlRes = await requestDocumentUploadUrlAction({
          meetingId: meeting.id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream'
        });
        if (urlRes?.error || !urlRes?.data) {
          setError(urlRes?.error ?? 'Không xin được URL tải lên.');
          return;
        }

        await putFileToStorage(urlRes.data.uploadUrl, file);

        const res = await confirmDocumentUploadAction({
          meetingId: meeting.id,
          title,
          description,
          storagePath: urlRes.data.storagePath,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size
        });
        if (res?.error) setError(res.error);
        else formRef.current?.reset();
      } catch (e: any) {
        setError(e?.message ?? 'Tải tài liệu lên thất bại.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <form ref={formRef} action={handleUpload} className="card p-4 space-y-2.5">
          <h3 className="font-semibold">Tải tài liệu lên (lưu trên server vật lý)</h3>
          <input name="title" required placeholder="Tiêu đề tài liệu" className="input" />
          <textarea name="description" placeholder="Mô tả (tuỳ chọn)" rows={2} className="input" />
          <input name="file" type="file" required className="input" />
          {error && <p className="text-red text-sm">{error}</p>}
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Đang tải lên…' : 'Tải lên'}
          </button>
        </form>
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
