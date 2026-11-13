'use client';

import { useRef, useState } from 'react';
import { ACCEPT_ATTR, MAX_FILES_PER_BATCH, formatFileSize, validateFileClient } from '@/lib/storage/constants';

export type FileStatus = { state: 'pending' | 'uploading' | 'done' | 'error'; message?: string };

export function fileKey(f: File) {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

/**
 * Ô chọn NHIỀU file: bấm chọn hoặc kéo-thả, có thể chọn nhiều lần (cộng dồn),
 * thấy danh sách file đã chọn kèm dung lượng + trạng thái, bỏ từng file bằng nút ×.
 * Component này KHÔNG tự upload — chỉ giữ danh sách; component cha quyết định.
 */
export default function MultiFilePicker({
  files,
  onChange,
  statuses = {},
  disabled = false,
  maxFiles = MAX_FILES_PER_BATCH,
  onReject
}: {
  files: File[];
  onChange: (files: File[]) => void;
  statuses?: Record<string, FileStatus>;
  disabled?: boolean;
  maxFiles?: number;
  /** Báo cho cha các file bị loại ngay từ đầu (sai định dạng/quá lớn/quá số lượng). */
  onReject?: (messages: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const have = new Set(files.map(fileKey));
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const f of incoming) {
      if (have.has(fileKey(f))) continue; // trùng file đã chọn -> bỏ qua
      const err = validateFileClient(f);
      if (err) {
        rejected.push(`${f.name}: ${err}`);
        continue;
      }
      if (files.length + accepted.length >= maxFiles) {
        rejected.push(`${f.name}: vượt quá ${maxFiles} file cho mỗi lần tải.`);
        continue;
      }
      accepted.push(f);
      have.add(fileKey(f));
    }
    if (accepted.length) onChange([...files, ...accepted]);
    onReject?.(rejected);
    if (inputRef.current) inputRef.current.value = ''; // cho phép chọn lại đúng file vừa bỏ
  }

  function remove(key: string) {
    onChange(files.filter((f) => fileKey(f) !== key));
  }

  const totalSize = files.reduce((n, f) => n + f.size, 0);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded border-2 border-dashed px-3 py-4 text-center text-sm transition-colors ${
          dragging ? 'border-gold bg-gold/5' : 'border-line'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          disabled={disabled}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="btn text-xs disabled:opacity-40"
        >
          + Chọn file
        </button>
        <p className="text-xs text-inksoft mt-1.5">
          hoặc kéo thả nhiều file vào đây (tối đa {maxFiles} file, mỗi file ≤ 100MB)
        </p>
      </div>

      {files.length > 0 && (
        <>
          <ul className="rounded border border-line divide-y divide-line bg-surface">
            {files.map((f) => {
              const key = fileKey(f);
              const st = statuses[key];
              return (
                <li key={key} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="shrink-0">
                    {st?.state === 'done' ? '✅' : st?.state === 'error' ? '⚠️' : st?.state === 'uploading' ? '⏳' : '📎'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{f.name}</span>
                    {st?.state === 'error' && <span className="block text-xs text-red">{st.message}</span>}
                  </span>
                  <span className="text-xs text-inksoft shrink-0">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => remove(key)}
                    className="text-inksoft hover:text-red disabled:opacity-30 shrink-0"
                    aria-label={`Bỏ file ${f.name}`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-inksoft">
            Đã chọn {files.length} file · tổng {formatFileSize(totalSize)}
          </p>
        </>
      )}
    </div>
  );
}
