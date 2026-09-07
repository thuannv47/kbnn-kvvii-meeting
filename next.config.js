/** @type {import('next').NextConfig} */
const nextConfig = {
  // LƯU Ý: file tài liệu KHÔNG còn đi qua Server Action nữa (xem lib/storage/b2.ts) —
  // trình duyệt PUT thẳng lên Backblaze B2 bằng presigned URL, vì Vercel Functions
  // giới hạn cứng request/response body ở 4.5MB dù bodySizeLimit đặt cao hơn.
  // Giá trị dưới đây chỉ áp dụng cho các Server Action còn lại (form dữ liệu văn bản).
  experimental: { serverActions: { bodySizeLimit: '2mb' } }
  // Đã bỏ output: 'standalone' — đó là tuỳ chọn cho tự deploy Docker/PM2 trên
  // server vật lý; Vercel tự đóng gói build của riêng nó, không cần cờ này.
};
module.exports = nextConfig;
