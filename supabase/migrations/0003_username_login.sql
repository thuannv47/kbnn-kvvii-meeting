-- ============================================================
-- Đăng nhập bằng "Tên đăng nhập" thay vì email
-- ============================================================
-- Supabase Auth vẫn lưu email trong auth.users (bắt buộc), nhưng đó là email
-- NỘI BỘ được hệ thống tự sinh ra (dạng <username>@accounts.meeting-system.local),
-- người dùng không hề thấy/nhập email này. "username" thật hiển thị/quản lý ở
-- cột dưới đây.

alter table profiles add column if not exists username text;

-- Ràng buộc định dạng: chữ thường, số, dấu . _ - , 3-30 ký tự, bắt đầu bằng chữ/số.
alter table profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

alter table profiles add constraint profiles_username_unique unique (username);

create index if not exists idx_profiles_username on profiles(username);

-- Nếu database của bạn đang trống (mới reset) thì bỏ qua bước dưới.
-- Nếu đã có dữ liệu cũ (profiles chưa có username), tạm sinh username từ id
-- để không vi phạm NOT NULL, rồi tự đổi lại cho đúng sau trong màn hình "Sửa người dùng":
update profiles set username = 'user_' || substr(id::text, 1, 8) where username is null;

alter table profiles alter column username set not null;
