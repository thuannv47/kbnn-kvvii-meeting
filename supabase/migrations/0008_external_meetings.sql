-- ============================================================
-- Họp NỘI BỘ vs họp NGOÀI NGÀNH + tag người được cử đi tham dự.
-- ============================================================
-- Bối cảnh nghiệp vụ: lãnh đạo nhận giấy mời họp ngoài ngành (qua Zalo/email),
-- rồi vào hệ thống tạo 1 cuộc họp loại "Ngoài ngành" — nhập địa điểm, thời gian,
-- tag người được cử đi thay mặt tham dự (và có thể đính kèm giấy mời ngay).
-- Người được cử đi cần thấy được cuộc họp này NGAY (kể cả khi còn ở dạng Nháp,
-- giống cách phòng chủ trì/người tạo luôn thấy được) để biết mình được cử đi,
-- và được phép tải tài liệu lên cho lãnh đạo xem sau khi đi họp về.

create type meeting_type as enum ('INTERNAL', 'EXTERNAL');

alter table meetings add column meeting_type meeting_type not null default 'INTERNAL';

-- ---------- MEETING PARTICIPANTS (người được tag/cử đi tham dự) ----------
create table meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references profiles(id),
  assigned_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (meeting_id, user_id)
);

alter table meeting_participants enable row level security;

-- Xem: ai xem được cuộc họp thì xem được danh sách người được cử đi.
-- Sửa: chỉ người quản lý được cuộc họp (người tạo / trưởng-phó phòng chủ trì / ADMIN).
create policy "participants_select" on meeting_participants for select using (can_view_meeting(meeting_id));
create policy "participants_write" on meeting_participants for all
  using (can_manage_meeting(meeting_id)) with check (can_manage_meeting(meeting_id));

-- ---------- Mở rộng can_view_meeting / can_comment_meeting ----------
-- Thêm điều kiện: người có tên trong meeting_participants luôn xem được +
-- góp ý/tải tài liệu được, KHÔNG phụ thuộc phòng ban hay trạng thái Nháp —
-- giống hệt cách host_department_id / created_by đã được ưu tiên ở migration 0006.
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
      select 1 from meeting_participants mp where mp.meeting_id = m_id and mp.user_id = auth.uid()
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
      select 1 from meeting_participants mp where mp.meeting_id = m_id and mp.user_id = auth.uid()
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
