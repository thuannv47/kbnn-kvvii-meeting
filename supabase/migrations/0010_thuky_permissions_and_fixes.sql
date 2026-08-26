-- ============================================================
-- Quyền hạn của THƯ KÝ (THUKY) + vá 2 lỗi thiếu sót từ migration 0008.
-- ============================================================
-- Bối cảnh nghiệp vụ: Ban Giám đốc (BGD) không tự tay thao tác hệ thống —
-- giao cho 1 người (thư ký) đứng ra sắp đặt, tạo, chỉnh sửa, và Duyệt các
-- cuộc họp thay mặt BGD. Về mặt kỹ thuật, thư ký là 1 tài khoản có:
--   - profiles.department_id = id của phòng "Ban Giám đốc"
--   - profiles.role = 'THUKY'
-- Nhờ vậy:
--   - meetings_insert (0002) đã cho phép tạo họp chủ trì bởi ĐÚNG phòng ban
--     của mình (host_department_id = my_department_id()) — không cần sửa gì
--     thêm, thư ký đã tạo được họp chủ trì "Ban Giám đốc".
--   - can_view_meeting/can_comment_meeting (0008) đã cho phép người tạo và
--     thành viên CÙNG phòng chủ trì xem được cuộc họp đã duyệt — cũng không
--     cần sửa gì thêm.
-- CHỈ CÒN THIẾU: can_manage_meeting hiện chỉ cho role MANAGER/BGD của phòng
-- chủ trì được quản lý (Duyệt/Đóng/Huỷ) cuộc họp — cần bổ sung THUKY vào đây,
-- để thư ký quản lý được cả những cuộc họp do người KHÁC trong phòng Ban
-- Giám đốc tạo (không chỉ mỗi cuộc họp do chính thư ký tạo).
--
-- QUAN TRỌNG: KHÔNG thêm THUKY vào is_bgd() — thư ký chỉ quản lý được cuộc
-- họp do phòng mình (Ban Giám đốc) chủ trì, KHÔNG có quyền giám sát toàn
-- ngành như BGD/ADMIN thực sự (is_bgd() vẫn giữ nguyên chỉ ADMIN/BGD).

create or replace function can_manage_meeting(m_id uuid) returns boolean as $$
  select is_admin()
    or exists(
      select 1 from meetings mt where mt.id = m_id and mt.created_by = auth.uid()
    )
    or exists(
      select 1 from meetings mt
      join profiles p on p.id = auth.uid()
      where mt.id = m_id
        and mt.host_department_id = p.department_id
        and p.role in ('MANAGER', 'BGD', 'THUKY')
    );
$$ language sql stable security definer;

-- ============================================================
-- VÁ 2 LỖI CÒN SÓT TỪ MIGRATION 0008 (chưa từng chạy, phát hiện khi rà soát):
-- ============================================================
-- 1) createMeetingAction ghi "location" vào MỌI cuộc họp (kể cả nội bộ), nhưng
--    0008 chưa từng tạo cột này -> tạo cuộc họp sẽ lỗi "column location does
--    not exist" ngay khi submit, ở CẢ họp nội bộ lẫn ngoài ngành.
alter table meetings add column if not exists location text;
comment on column meetings.location is 'Địa điểm tổ chức — bắt buộc khi meeting_type = EXTERNAL, để trống khi nội bộ.';
