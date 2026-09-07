-- ============================================================
-- 0005: Cho phép đính kèm 1 FILE kết luận cuộc họp (văn bản chính thức
-- do chủ trì / Ban Giám đốc tải lên), thay vì chỉ nhập nội dung dạng text.
-- File này lưu trên Backblaze B2 giống các tài liệu khác, dùng chung
-- cơ chế presigned URL (xem lib/storage/b2.ts).
-- ============================================================

alter table meeting_conclusions
  add column if not exists file_name text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists attached_by uuid references profiles(id),
  add column if not exists attached_at timestamptz;

-- Không cần policy RLS mới: các cột trên nằm trong cùng bảng meeting_conclusions,
-- đã được bảo vệ bởi policy "conclusion_select" / "conclusion_write" / "conclusion_update"
-- có sẵn từ 0001_init.sql (dựa trên can_view_meeting / can_manage_meeting).
