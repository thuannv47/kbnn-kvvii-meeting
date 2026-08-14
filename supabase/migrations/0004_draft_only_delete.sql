-- ============================================================
-- SIẾT QUYỀN: xoá cuộc họp & sửa/xoá nội dung khi còn NHÁP (DRAFT)
-- ============================================================
-- Yêu cầu nghiệp vụ mới:
-- 1) Xoá HẲN một cuộc họp: CHỈ Quản trị viên (ADMIN), và CHỈ khi cuộc họp còn ở
--    trạng thái Nháp (DRAFT). Cuộc họp đang diễn ra (OPEN) hoặc đã đóng/lưu trữ
--    (CLOSED/ARCHIVED) thì KHÔNG được xoá dưới bất kỳ hình thức nào, kể cả ADMIN
--    (chỉ có thể "huỷ" bằng cách đổi status sang ARCHIVED, vẫn giữ dữ liệu).
-- 2) Khi cuộc họp còn Nháp: CHỈ người tạo/chủ trì phòng họp mới được SỬA (thêm
--    version tài liệu) hoặc XOÁ nội dung đã có (tài liệu, ý kiến, tệp đính kèm).
--    Một khi cuộc họp rời trạng thái Nháp, nội dung trở thành cố định — không ai
--    (kể cả người tạo) sửa/xoá được nữa, trừ ADMIN (dùng để khắc phục sự cố).

-- ---------- helper: người tạo cuộc họp, cuộc họp còn Nháp ----------
create or replace function is_draft_meeting_creator(m_id uuid) returns boolean as $$
  select exists(
    select 1 from meetings mt
    where mt.id = m_id and mt.status = 'DRAFT' and mt.created_by = auth.uid()
  );
$$ language sql stable security definer;

-- ---------- meetings_delete: chỉ ADMIN + chỉ khi còn DRAFT ----------
drop policy if exists "meetings_delete" on meetings;
create policy "meetings_delete" on meetings for delete using (
  is_admin() and status = 'DRAFT'
);

-- ---------- documents: sửa/xoá chỉ ADMIN hoặc người tạo họp khi còn Nháp ----------
drop policy if exists "documents_update" on documents;
create policy "documents_update" on documents for update using (
  is_admin() or is_draft_meeting_creator(meeting_id)
);

drop policy if exists "documents_delete" on documents;
create policy "documents_delete" on documents for delete using (
  is_admin() or is_draft_meeting_creator(meeting_id)
);

-- ---------- document_versions: thêm version mới (= sửa tài liệu) ----------
-- Giữ nguyên policy insert version-1 lúc TẠO tài liệu (dùng chung bảng nên không tách
-- được version 1 và version sau bằng RLS); việc chặn "chỉ người tạo được thêm version sau
-- khi đã có version 1" đã được xử lý ở lớp Server Action (xem canAddVersion trong
-- lib/permissions). Ở đây bổ sung thêm điều kiện cho phép ADMIN/người tạo họp (khi Nháp)
-- luôn thêm được version, để không bị RLS chặn nhầm khi họ hợp lệ.
drop policy if exists "doc_versions_insert" on document_versions;
create policy "doc_versions_insert" on document_versions for insert with check (
  can_comment_meeting((select meeting_id from documents where id = document_id))
  or is_admin()
  or is_draft_meeting_creator((select meeting_id from documents where id = document_id))
);

create policy "doc_versions_delete" on document_versions for delete using (
  is_admin()
  or is_draft_meeting_creator((select meeting_id from documents where id = document_id))
);

-- ---------- meeting_comments: xoá chỉ ADMIN hoặc người tạo họp khi còn Nháp ----------
-- (Trước đây "comments_delete" cho phép chính chủ ý kiến tự xoá bất kỳ lúc nào — thay
-- bằng quy tắc mới: chỉ người tạo/chủ trì phòng họp hoặc ADMIN, và chỉ khi còn Nháp.)
drop policy if exists "comments_delete" on meeting_comments;
create policy "comments_delete" on meeting_comments for delete using (
  is_admin() or is_draft_meeting_creator(meeting_id)
);

-- ---------- comment_attachments: xoá kèm theo khi xoá comment (cascade), nhưng cũng
-- cho phép xoá trực tiếp attachment theo cùng quy tắc ----------
create policy "comment_att_delete" on comment_attachments for delete using (
  is_admin()
  or is_draft_meeting_creator((select meeting_id from meeting_comments where id = comment_id))
);
