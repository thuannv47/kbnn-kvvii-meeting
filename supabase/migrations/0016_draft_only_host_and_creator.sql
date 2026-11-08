-- ============================================================
-- Cuộc họp NHÁP (DRAFT) "chưa có hiệu lực": CHỈ người tạo, thành viên phòng chủ trì
-- và ADMIN hệ thống (để còn xoá được bản nháp) mới xem/góp ý được.
-- ============================================================
-- Trước đây can_view_meeting() cho phép xem bản nháp với: mọi tài khoản role ADMIN/BGD
-- (is_bgd()), mọi THƯ KÝ (is_thuky()), và bất kỳ ai được tag trong meeting_participants.
-- Sau khi cuộc họp được DUYỆT (status <> 'DRAFT') mọi quy tắc cũ được GIỮ NGUYÊN.
--
-- Hàm meetings_overview() (lịch họp toàn ngành) vốn đã chỉ lấy status OPEN/CLOSED nên không cần sửa.
--
-- Cách quay lại bản cũ: xem 2 hàm gốc ở cuối file (đang để comment).

create or replace function can_view_meeting(m_id uuid) returns boolean as $$
  select case
    when exists (select 1 from meetings mt where mt.id = m_id and mt.status = 'DRAFT') then
      -- NHÁP: ADMIN, người tạo, hoặc thành viên phòng chủ trì
      exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'ADMIN' and me.active)
      or exists (
        select 1 from meetings mt
        where mt.id = m_id
          and (mt.created_by = auth.uid() or mt.host_department_id = my_department_id())
      )
    else
      -- ĐÃ DUYỆT: giữ nguyên quy tắc hiện tại
      is_bgd()
      or is_thuky()
      or exists(
        select 1 from meetings mt
        where mt.id = m_id and mt.host_department_id = my_department_id()
      )
      or exists(
        select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid()
      )
      or exists(
        select 1 from meeting_participants mp where mp.meeting_id = m_id and mp.user_id = auth.uid()
      )
      or exists(
        select 1 from meeting_departments md
        where md.meeting_id = m_id
          and md.department_id = my_department_id()
          and md.can_view
      )
  end;
$$ language sql stable security definer;

create or replace function can_comment_meeting(m_id uuid) returns boolean as $$
  select case
    when exists (select 1 from meetings mt where mt.id = m_id and mt.status = 'DRAFT') then
      exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'ADMIN' and me.active)
      or exists (
        select 1 from meetings mt
        where mt.id = m_id
          and (mt.created_by = auth.uid() or mt.host_department_id = my_department_id())
      )
    else
      is_bgd()
      or exists(
        select 1 from meetings mt
        where mt.id = m_id and mt.host_department_id = my_department_id()
      )
      or exists(
        select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid()
      )
      or exists(
        select 1 from meeting_participants mp where mp.meeting_id = m_id and mp.user_id = auth.uid()
      )
      or exists(
        select 1 from meeting_departments md
        where md.meeting_id = m_id
          and md.department_id = my_department_id()
          and md.can_comment
      )
  end;
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- ROLLBACK (bản đang chạy trước khi áp file này) — chỉ chạy nếu cần quay lại:
--
-- create or replace function can_view_meeting(m_id uuid) returns boolean as $$
--   select is_bgd()
--     or is_thuky()
--     or exists(select 1 from meetings mt where mt.id = m_id and mt.host_department_id = my_department_id())
--     or exists(select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid())
--     or exists(select 1 from meeting_participants mp where mp.meeting_id = m_id and mp.user_id = auth.uid())
--     or exists(
--       select 1 from meeting_departments md
--       join meetings mt on mt.id = md.meeting_id
--       where md.meeting_id = m_id and md.department_id = my_department_id()
--         and md.can_view and mt.status <> 'DRAFT'
--     );
-- $$ language sql stable security definer;
--
-- create or replace function can_comment_meeting(m_id uuid) returns boolean as $$
--   select is_bgd()
--     or exists(select 1 from meetings mt where mt.id = m_id and mt.host_department_id = my_department_id())
--     or exists(select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid())
--     or exists(select 1 from meeting_participants mp where mp.meeting_id = m_id and mp.user_id = auth.uid())
--     or exists(
--       select 1 from meeting_departments md
--       join meetings mt on mt.id = md.meeting_id
--       where md.meeting_id = m_id and md.department_id = my_department_id()
--         and md.can_comment and mt.status <> 'DRAFT'
--     );
-- $$ language sql stable security definer;
