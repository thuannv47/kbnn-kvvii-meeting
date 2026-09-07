-- ============================================================
-- Cho phép THƯ KÝ (THUKY) xem được TOÀN BỘ user đang hoạt động, không chỉ
-- người cùng phòng ban với mình.
-- ============================================================
-- Bối cảnh nghiệp vụ: khi tạo cuộc họp Ngoài ngành, thư ký cần tag (cử đi)
-- người tham dự thay mặt BGD — người được cử có thể là bất kỳ ai, kể cả
-- trưởng/phó phòng thuộc các phòng ban khác (không cùng phòng "Ban Giám đốc"
-- với thư ký).
--
-- Lỗi trước đây: policy "profiles_select" (0001_init.sql) chỉ cho xem
--   - chính mình, HOẶC
--   - là BGD/ADMIN (is_bgd()), HOẶC
--   - cùng phòng ban (department_id = my_department_id())
-- Vì thư ký có department_id = phòng "Ban Giám đốc" (xem 0010) và KHÔNG phải
-- BGD/ADMIN thật sự, nên thư ký chỉ thấy được người trong phòng "Ban Giám
-- đốc" (BGD, admin...) mà KHÔNG thấy trưởng/phó phòng của các phòng ban khác
-- -> danh sách "Người tham gia dự họp" ở form tạo họp bị thiếu người dù
-- frontend đã truy vấn "toàn bộ user active" (bị RLS chặn ngay ở tầng DB,
-- trước khi tới được component).
--
-- Dùng SECURITY DEFINER giống is_admin()/is_bgd() để tránh đệ quy RLS khi
-- policy tự truy vấn lại chính bảng profiles.
create or replace function is_thuky() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'THUKY' and active);
$$ language sql stable security definer;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (
  id = auth.uid() or is_bgd() or is_thuky() or department_id = my_department_id()
);
