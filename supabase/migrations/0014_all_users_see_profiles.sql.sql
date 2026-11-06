-- ============================================================
-- 1) THƯ KÝ (THUKY) xem được TOÀN BỘ cuộc họp (mọi loại, mọi trạng thái).
-- 2) Mọi user active được chọn BẤT KỲ phòng ban làm "Phòng chủ trì".
-- ============================================================
-- Dùng thêm policy SELECT riêng cho THUKY (các policy cùng loại được OR với
-- nhau) thay vì sửa can_view_meeting() -> không phụ thuộc vào phiên bản hàm
-- đang chạy trên DB của bạn, và KHÔNG cấp thêm quyền sửa/xoá/góp ý cho thư ký.

create or replace function is_thuky() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'THUKY' and active);
$$ language sql stable security definer;

drop policy if exists "meetings_select_thuky" on meetings;
create policy "meetings_select_thuky" on meetings for select using (is_thuky());

drop policy if exists "md_select_thuky" on meeting_departments;
create policy "md_select_thuky" on meeting_departments for select using (is_thuky());

drop policy if exists "participants_select_thuky" on meeting_participants;
create policy "participants_select_thuky" on meeting_participants for select using (is_thuky());

drop policy if exists "documents_select_thuky" on documents;
create policy "documents_select_thuky" on documents for select using (is_thuky());

drop policy if exists "doc_versions_select_thuky" on document_versions;
create policy "doc_versions_select_thuky" on document_versions for select using (is_thuky());

drop policy if exists "comments_select_thuky" on meeting_comments;
create policy "comments_select_thuky" on meeting_comments for select using (is_thuky());

drop policy if exists "comment_att_select_thuky" on comment_attachments;
create policy "comment_att_select_thuky" on comment_attachments for select using (is_thuky());

drop policy if exists "conclusion_select_thuky" on meeting_conclusions;
create policy "conclusion_select_thuky" on meeting_conclusions for select using (is_thuky());

drop policy if exists "conclusion_versions_select_thuky" on conclusion_versions;
create policy "conclusion_versions_select_thuky" on conclusion_versions for select using (is_thuky());

-- ---------- Phòng chủ trì: không còn giới hạn theo phòng của mình ----------
drop policy if exists "meetings_insert" on meetings;
create policy "meetings_insert" on meetings for insert with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.active)
);
