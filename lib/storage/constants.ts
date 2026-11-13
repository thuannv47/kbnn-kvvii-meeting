/**
 * Hằng số upload dùng CHUNG cho server (kiểm tra trước khi cấp URL) và
 * trình duyệt (kiểm tra sớm để báo lỗi ngay, không đợi tới lúc xin URL).
 * File này không import gì từ server nên import được ở client component.
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB / file
export const MAX_FILES_PER_BATCH = 20; // số file tối đa mỗi lần chọn
export const MAX_ATTACHMENTS_PER_COMMENT = 10;

export const ALLOWED_MIME = [
  'application/pdf',
  // Office đời mới
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Office đời cũ (.doc/.xls/.ppt) — trước đây bị chặn nên nhiều văn bản không tải lên được
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  // Văn bản thuần, bảng tính CSV
  'text/plain',
  'text/csv',
  // Ảnh
  'image/png',
  'image/jpeg'
];

export const ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg';

export function formatFileSize(bytes?: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Kiểm tra 1 file ở phía trình duyệt. Trả về thông báo lỗi hoặc null nếu hợp lệ. */
export function validateFileClient(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return 'File rỗng (0 KB).';
  if (file.size > MAX_FILE_SIZE) return `File vượt quá ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
  // Một số file (VD .doc cũ) trình duyệt không nhận ra loại -> type rỗng: để server quyết định.
  if (file.type && !ALLOWED_MIME.includes(file.type)) return 'Định dạng file không được hỗ trợ.';
  return null;
}
