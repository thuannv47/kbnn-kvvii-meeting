-- ============================================================
-- FIX: tài khoản mới (MEMBER) không tạo được cuộc họp
-- ============================================================
-- Nguyên nhân: policy "meetings_insert" cũ chỉ cho phép role
-- MANAGER/BGD (hoặc ADMIN) insert vào bảng meetings, trong khi UI/permission
-- layer (lib/permissions) cũng chặn theo đúng logic đó -> mọi tài khoản
-- MEMBER mới tạo đều bị từ chối ngay từ đầu, và người dùng nghĩ "chỉ admin mới
-- tạo được cuộc họp".
--
-- Fix: cho phép MỌI tài khoản đang hoạt động (active) tạo cuộc họp, nhưng chỉ
-- được chọn "Phòng chủ trì" đúng phòng ban của chính mình (trừ BGD/ADMIN được
-- chọn bất kỳ phòng nào để điều phối liên phòng). Đồng thời, người tạo ra một
-- cuộc họp thì luôn được QUẢN LÝ (sửa, đổi trạng thái, phân quyền phòng ban,
-- soạn kết luận) cuộc họp đó, không chỉ riêng MANAGER/BGD của phòng chủ trì.

-- ---------- can_manage_meeting: thêm điều kiện "người tạo" ----------
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
        and p.role in ('MANAGER','BGD')
    );
$$ language sql stable security definer;

-- ---------- meetings_insert: mọi user active, chỉ chủ trì phòng của mình ----------
drop policy if exists "meetings_insert" on meetings;
create policy "meetings_insert" on meetings for insert with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.active)
  and (
    is_bgd() -- ADMIN/BGD: được tạo họp chủ trì bởi bất kỳ phòng ban nào
    or host_department_id = my_department_id() -- MANAGER/MEMBER: chỉ phòng của chính mình
  )
);

-- ---------- meetings_delete: cho phép người tạo tự xoá cuộc họp còn ở dạng nháp ----------
drop policy if exists "meetings_delete" on meetings;
create policy "meetings_delete" on meetings for delete using (
  is_admin() or (created_by = auth.uid() and status = 'DRAFT')
);
