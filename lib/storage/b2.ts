import 'server-only';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

/**
 * Lưu trữ file trên Backblaze B2 qua API tương thích S3 (thay cho ổ đĩa vật lý).
 *
 * LÝ DO: Vercel Functions (Server Actions / Route Handlers) giới hạn cứng
 * request/response body ở mức 4.5MB — không đủ cho tài liệu cỡ vài chục MB.
 * Vì vậy KHÔNG gửi file qua Server Action, mà dùng "presigned URL":
 *   1) Server Action kiểm tra quyền, sinh 1 URL PUT có chữ ký, hết hạn sau vài phút.
 *   2) Trình duyệt PUT file thẳng lên B2 bằng URL đó (không qua Vercel Function).
 *   3) Server Action thứ 2 ghi metadata (đường dẫn, tên file, kích thước…) vào DB.
 * Tải xuống tương tự: Route Handler xác thực quyền qua Supabase RLS rồi
 * redirect (302) sang 1 URL GET có chữ ký, hết hạn sau ~1 phút.
 */

export type StorageBucket = 'meeting-documents' | 'meeting-comments' | 'meeting-conclusions';

const BUCKET = process.env.B2_BUCKET!;
const REGION = process.env.B2_REGION || 'us-west-004';
const ENDPOINT = process.env.B2_ENDPOINT!; // VD: https://s3.us-west-004.backblazeb2.com

function getClient() {
  return new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!
    },
    // AWS SDK v3 (bản mới) mặc định tự thêm header/query checksum
    // (x-amz-sdk-checksum-algorithm, x-amz-checksum-crc32) vào mọi request.
    // Backblaze B2 (S3-compatible API) chưa hỗ trợ tính năng này, dẫn tới
    // preflight OPTIONS bị B2 từ chối và trình duyệt báo lỗi CORS dù cấu
    // hình CORS trên bucket đã đúng. Tắt hẳn để presigned URL hoạt động bình thường.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
}

/** Sinh storage_path (= object key trên B2) tương tự cấu trúc cũ trên ổ đĩa. */
export function buildStoragePath(opts: {
  bucket: StorageBucket;
  meetingCode: string;
  departmentCode: string;
  version: number;
  fileName: string;
}) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const safeName = sanitizeFileName(opts.fileName);
  return [
    opts.bucket,
    yyyy,
    mm,
    opts.meetingCode,
    opts.departmentCode,
    `v${opts.version}`,
    `${crypto.randomUUID()}__${safeName}`
  ].join('/');
}

/** URL để trình duyệt PUT file thẳng lên B2 (không qua Vercel Function). Hết hạn sau 5 phút. */
export async function getUploadUrl(storagePath: string, contentType: string) {
  const client = getClient();
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
    ContentType: contentType || 'application/octet-stream'
  });
  return getSignedUrl(client, cmd, { expiresIn: 300 });
}

/** URL để tải file trực tiếp từ B2. Hết hạn sau 1 phút — chỉ dùng để redirect ngay. */
export async function getDownloadUrl(storagePath: string, fileName: string, mimeType?: string | null) {
  const client = getClient();
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
    ResponseContentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    ResponseContentType: mimeType || 'application/octet-stream'
  });
  return getSignedUrl(client, cmd, { expiresIn: 60 });
}

export async function deleteFile(storagePath: string) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storagePath }));
}

// Giới hạn kích thước/loại file — không còn bị chặn bởi Vercel Function 4.5MB
// vì file đi thẳng trình duyệt -> B2, nhưng vẫn kiểm tra ở server trước khi cấp URL.
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg'
];
