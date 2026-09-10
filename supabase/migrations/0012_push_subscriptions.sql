-- Lưu thông tin đăng ký nhận Push Notification (Web Push API) của từng thiết bị/trình
-- duyệt người dùng đã bấm "Bật thông báo". Một người dùng có thể có nhiều dòng (nhiều
-- thiết bị: điện thoại, máy tính...) vì mỗi thiết bị có "endpoint" riêng.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- Người dùng chỉ được xem/thêm/xoá subscription của chính mình.
-- Việc GỬI push (đọc subscription của người KHÁC để gửi) chỉ thực hiện ở server
-- bằng Service Role Key (bỏ qua RLS), KHÔNG đi qua client với ANON_KEY.
drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
