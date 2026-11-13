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
    // Backblaze B2 (và các dịch vụ tương thích S3 khác) không hỗ trợ các
    // tham số checksum kiểu mới mà AWS SDK v3 tự thêm mặc định vào presigned
    // URL (x-amz-checksum-crc32, x-amz-sdk-checksum-algorithm). Nếu để mặc
    // định, presigned URL sẽ bị B2 từ chối, và trình duyệt báo nhầm thành lỗi CORS.
    requestChecksumCalculation: 'WHEN_REQUIRED'
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

// Giới hạn kích thước/loại file nằm ở constants.ts (dùng chung với trình duyệt).
export { MAX_FILE_SIZE, ALLOWED_MIME } from './constants';

/**
 * Chống giả mạo storage_path: đường dẫn do trình duyệt gửi lên ở bước "xác nhận"
 * phải đúng là đường dẫn server đã cấp cho CHÍNH cuộc họp này
 * (cấu trúc: <bucket>/<yyyy>/<mm>/<mã cuộc họp>/...). Nếu không, người dùng có thể
 * gắn đường dẫn file của cuộc họp khác vào tài liệu/ý kiến của mình để đọc lén.
 */
export function isStoragePathOfMeeting(storagePath: string, bucket: StorageBucket, meetingCode: string) {
  const parts = storagePath.split('/');
  return (
    parts.length >= 7 &&
    parts[0] === bucket &&
    /^\d{4}$/.test(parts[1]) &&
    /^\d{2}$/.test(parts[2]) &&
    parts[3] === meetingCode &&
    !parts.includes('..')
  );
}
