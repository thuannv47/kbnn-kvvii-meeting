# Phòng họp không giấy tờ — Next.js + Supabase + Backblaze B2

Hệ thống quản lý cuộc họp điện tử: tạo cuộc họp, phân quyền phòng ban tham gia,
upload tài liệu (lưu trên **Backblaze B2**, qua API tương thích S3),
tham gia ý kiến, soạn/xác nhận kết luận, tìm kiếm lịch sử, audit log.

## 1. Kiến trúc

```
NGƯỜI DÙNG (Web PC / Điện thoại)
        │
        ▼
   Next.js App Router (Vercel)  ──►  Server Actions / Route Handlers
        │                                   │
        ▼                                   ▼
   Supabase (Auth + PostgreSQL + RLS)    Backblaze B2 (file thật, qua presigned URL)
```

Phân quyền theo **3 lớp**, không lớp nào được bỏ qua:
1. **UI (Next.js)** — ẩn/hiện nút theo `lib/permissions`.
2. **Server Actions** — kiểm tra lại quyền trước khi động DB (`requireUser` + `lib/permissions`).
3. **Supabase RLS** — lớp chặn cuối cùng, không thể bị vượt qua kể cả khi gọi API trực tiếp
   (xem `supabase/migrations/0001_init.sql`).

### Vì sao dùng presigned URL thay vì gửi file qua Server Action?

Vercel Functions giới hạn cứng request/response body ở **4.5MB**, không đủ cho tài liệu
cỡ vài chục MB. Vì vậy file KHÔNG đi qua Server Action:

- **Upload**: Server Action (`requestDocumentUploadUrlAction`, …) kiểm tra quyền qua
  `lib/permissions` rồi sinh 1 URL PUT có chữ ký (hết hạn sau 5 phút) trỏ thẳng tới B2.
  Trình duyệt PUT file thẳng lên B2 bằng URL đó. Sau khi PUT xong, một Server Action
  thứ hai (`confirmDocumentUploadAction`, …) mới ghi metadata (tên file, đường dẫn,
  kích thước…) vào Supabase — **không có byte nào của file đi qua Vercel Function**.
- **Tải xuống**: route `/api/download/...` vẫn luôn truy vấn Supabase trước (bị RLS
  chi phối) để xác nhận quyền xem, sau đó `redirect` (302) sang 1 URL GET có chữ ký
  của B2 (hết hạn sau 1 phút) — trình duyệt tải trực tiếp từ B2.

Xem chi tiết trong `lib/storage/b2.ts`.

## 2. Cài đặt Supabase

1. Tạo project mới tại https://supabase.com.
2. Vào **SQL Editor**, chạy toàn bộ nội dung `supabase/migrations/0001_init.sql`.
   File này tạo bảng, trigger tự tính `visible_until`, full-text search, và toàn bộ RLS policies.
3. Vào **Authentication > Providers**, bật Email/Password (tắt "Confirm email" nếu muốn admin
   tạo tài khoản trực tiếp bằng mật khẩu tạm thời).
4. Tạo tài khoản Admin đầu tiên:
   - Vào **Authentication > Users > Add user**, tạo user với email/mật khẩu.
   - Vào **Table editor > profiles**, thêm 1 dòng: `id` = id user vừa tạo, `role = 'ADMIN'`,
     `department_id` = một phòng ban đã seed sẵn (VD: BGD).
   - Từ đây, đăng nhập bằng tài khoản này và dùng trang `/users` để tạo các tài khoản còn lại.
5. Lấy `Project URL`, `anon key`, `service_role key` tại **Project Settings > API** để điền vào `.env`.

## 3. Cài đặt Backblaze B2

1. Đăng nhập [Backblaze B2 Console](https://secure.backblaze.com/b2_buckets.htm) → **Create a Bucket**.
   - Tên bucket: bất kỳ, VD `meeting-system-storage`.
   - **Files in Bucket are: Private** (bắt buộc — không để Public, vì mọi quyền xem file
     đều phải qua kiểm tra RLS ở route `/api/download/...` trước khi cấp presigned URL).
2. Vào bucket vừa tạo, xem **Endpoint** hiển thị ở đầu trang, dạng
   `s3.us-west-004.backblazeb2.com` — phần `us-west-004` chính là **region**.
3. Vào **Application Keys** → **Add a New Application Key**:
   - Đặt tên gợi nhớ, VD `meeting-system-prod`.
   - **Allow access to Bucket(s)**: chọn đúng bucket vừa tạo (không để "All").
   - Quyền: **Read and Write**.
   - Bấm tạo → lưu lại ngay `keyID` và `applicationKey` (chỉ hiển thị **một lần**).

## 4. Cấu hình biến môi trường

```bash
cp .env.example .env
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # chỉ dùng ở server, KHÔNG public

B2_KEY_ID=...                          # keyID vừa tạo ở bước 3
B2_APPLICATION_KEY=...                 # applicationKey vừa tạo (giữ bí mật)
B2_BUCKET=meeting-system-storage
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004

NEXT_PUBLIC_APP_URL=https://hop.congty.vn
```

## 5. Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## 6. Deploy lên Vercel

1. Đẩy code lên GitHub (hoặc GitLab/Bitbucket):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <URL repo của bạn>
   git push -u origin main
   ```
2. Vào [vercel.com](https://vercel.com) → **Add New… → Project** → chọn repo vừa đẩy lên.
   Vercel tự nhận diện đây là app Next.js, không cần chỉnh Build Command / Output Directory.
3. Ở bước **Environment Variables**, thêm đầy đủ các biến ở mục 4 (dán từng dòng, hoặc
   copy nguyên nội dung file `.env` — Vercel hỗ trợ dán nhiều dòng cùng lúc). Nhớ thêm ở
   cả 3 môi trường **Production / Preview / Development** nếu bạn dùng preview deployments.
4. Bấm **Deploy**. Sau khi xong, vào **Settings → Domains** để gắn domain riêng (VD
   `hop.congty.vn`) nếu cần, rồi cập nhật lại `NEXT_PUBLIC_APP_URL` cho khớp.
5. Từ lần sau, mỗi lần `git push` lên nhánh `main` Vercel sẽ tự build & deploy lại
   (CI/CD có sẵn, không cần cấu hình thêm).

**Lưu ý dung lượng/chi phí:**
- Backblaze B2: 10GB lưu trữ đầu tiên miễn phí, sau đó ~$6/TB/tháng; tải xuống (egress)
  miễn phí tới 3 lần dung lượng đang lưu mỗi tháng.
- Vercel Hobby (miễn phí): đủ dùng cho nội bộ công ty quy mô nhỏ/vừa; lưu ý gói Hobby
  chỉ dành cho dự án phi thương mại — nếu vận hành chính thức cho doanh nghiệp, cân nhắc
  nâng lên gói Pro.
- Supabase Free: 500MB database, tạm dừng project sau 7 ngày không có request — nếu hệ
  thống dùng thật hàng ngày thì không đáng lo; nếu chỉ demo/thử nghiệm, để ý mục này.

## 7. Backup dữ liệu

- **Database**: Supabase tự động backup (Point-in-time recovery ở gói Pro trở lên), hoặc
  `pg_dump` định kỳ qua Connection string.
- **File trên B2**: bật **Lifecycle Settings** trên bucket nếu muốn giữ nhiều bản cũ, hoặc
  dùng `b2 sync` (B2 CLI) để đồng bộ sang một bucket/nhà cung cấp khác định kỳ.

## 8. Cấu trúc thư mục

```
app/
├── (auth)/login/                  # trang đăng nhập
├── (dashboard)/                   # layout có sidebar/bottom-nav, yêu cầu đăng nhập
│   ├── dashboard/                 # dashboard theo role
│   ├── meetings/{create,[id]}/    # danh sách / tạo / chi tiết (tabs) cuộc họp
│   ├── search/                    # tìm kiếm lịch sử (không lọc visible_until)
│   ├── departments/                # quản lý phòng ban
│   ├── users/                      # quản lý người dùng (Admin)
│   └── admin/audit/                 # audit log (Admin)
└── api/download/[...path]/         # kiểm tra quyền qua Supabase rồi redirect sang B2

actions/          # Server Actions — lớp phòng thủ thứ 2 (trước RLS)
lib/permissions/  # logic ẩn/hiện UI + kiểm tra sớm ở server, PHẢN CHIẾU đúng RLS
lib/storage/b2.ts # presigned URL upload/download qua Backblaze B2 (S3-compatible)
supabase/migrations/0001_init.sql  # schema + RLS đầy đủ
```

## 9. Vai trò & phân quyền

| Vai trò | Quyền |
|---|---|
| `ADMIN` | Toàn quyền hệ thống, quản lý người dùng/phòng ban, xem Audit Log |
| `BGD` (Ban Giám đốc) | Xem mọi cuộc họp, xác nhận kết luận |
| `MANAGER` (Trưởng/Phó phòng) | Tạo cuộc họp, quản lý cuộc họp do phòng mình chủ trì, soạn kết luận |
| `MEMBER` (Chuyên viên) | Xem/tham gia ý kiến các cuộc họp phòng mình được mời |

`visible_until = end_at + visibility_duration_hours` chỉ điều khiển việc **ẩn khỏi Dashboard**,
KHÔNG xoá dữ liệu — trang **Tìm kiếm** luôn truy vấn được toàn bộ lịch sử.
