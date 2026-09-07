-- ============================================================
-- FIX: cuộc họp NHÁP (DRAFT) đang bị lộ cho các phòng "được tham gia"
-- ngay từ lúc tạo, dù chưa được duyệt mở.
-- ============================================================
-- Nguyên nhân: can_view_meeting() / can_comment_meeting() cho phép xem
-- một khi có dòng trong meeting_departments (can_view/can_comment = true),
-- mà KHÔNG kiểm tra trạng thái cuộc họp. Trong khi đó, createMeetingAction
-- đã ghi các dòng phân quyền phòng tham gia NGAY khi tạo (kể cả khi tạo ở
-- dạng Nháp) -> phòng khác vào Dashboard đã thấy được cuộc họp còn đang
-- soạn thảo.
--
-- Quy tắc ĐÚNG theo nghiệp vụ:
-- - Cuộc họp NHÁP: CHỈ phòng chủ trì (host_department_id) + người tạo +
--   ADMIN/BGD nhìn thấy được (để soạn thảo, sửa, xoá nội dung).
-- - Sau khi bấm "Duyệt tạo cuộc họp" (status chuyển OPEN, hoặc CLOSED/ARCHIVED
--   về sau), các phòng được phân quyền (meeting_departments.can_view/can_comment)
--   mới bắt đầu nhìn thấy / góp ý được.
-- - ADMIN/BGD luôn thấy mọi cuộc họp ở mọi trạng thái (điều phối, giám sát).
-- - Phòng chủ trì luôn thấy cuộc họp do phòng mình chủ trì ở mọi trạng thái.

create or replace function can_view_meeting(m_id uuid) returns boolean as $$
  select is_bgd()
    or exists(
      select 1 from meetings mt
      where mt.id = m_id and mt.host_department_id = my_department_id()
    )
    or exists(
      select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid()
    )
    or exists(
      select 1 from meeting_departments md
      join meetings mt on mt.id = md.meeting_id
      where md.meeting_id = m_id
        and md.department_id = my_department_id()
        and md.can_view
        and mt.status <> 'DRAFT'
    );
$$ language sql stable security definer;

create or replace function can_comment_meeting(m_id uuid) returns boolean as $$
  select is_bgd()
    or exists(
      select 1 from meetings mt
      where mt.id = m_id and mt.host_department_id = my_department_id()
    )
    or exists(
      select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid()
    )
    or exists(
      select 1 from meeting_departments md
      join meetings mt on mt.id = md.meeting_id
      where md.meeting_id = m_id
        and md.department_id = my_department_id()
        and md.can_comment
        and mt.status <> 'DRAFT'
    );
$$ language sql stable security definer;
