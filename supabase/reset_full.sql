-- ============================================================
-- RESET TOÀN BỘ DATABASE — XOÁ SẠCH DỮ LIỆU + TÀI KHOẢN ĐĂNG NHẬP
-- ============================================================
-- CẢNH BÁO: script này XOÁ VĨNH VIỄN toàn bộ dữ liệu hiện có
-- (cuộc họp, tài liệu, bình luận, kết luận, audit log, phòng ban)
-- VÀ toàn bộ tài khoản đăng nhập trong auth.users.
-- File vật lý đã upload trên ổ đĩa (LOCAL_STORAGE_ROOT) KHÔNG bị xoá
-- (không thuộc phạm vi database) — bạn tự dọn thư mục storage nếu cần.
--
-- Sau khi chạy xong, database sẽ ở trạng thái sạch với schema + RLS đã
-- gộp sẵn bản vá lỗi phân quyền tạo cuộc họp (0001 + 0002 merge),
-- hỗ trợ đăng nhập bằng "Tên đăng nhập" (username) thay vì email (0003 merge),
-- VÀ đã siết quyền xoá cuộc họp (chỉ ADMIN + chỉ khi Nháp) cùng quyền sửa/xoá
-- nội dung (tài liệu/ý kiến/tệp đính kèm chỉ người tạo họp được sửa/xoá khi
-- còn Nháp) (0004 merge).
-- Chạy TOÀN BỘ script này 1 lần trong Supabase SQL Editor.
-- ============================================================

-- ---------- BƯỚC 1: XOÁ SCHEMA public HIỆN TẠI ----------
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;

-- ---------- BƯỚC 2: XOÁ TOÀN BỘ TÀI KHOẢN ĐĂNG NHẬP ----------
-- (an toàn vì bảng profiles vừa bị xoá cùng schema public ở trên,
--  không còn ràng buộc khoá ngoại nào trỏ tới auth.users nữa)
delete from auth.users;

-- ---------- BƯỚC 3: TẠO LẠI SCHEMA + RLS (đã gồm bản vá) ----------
-- ============================================================
-- PHÒNG HỌP KHÔNG GIẤY TỜ — Database schema + RLS
-- ============================================================
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type user_role as enum ('ADMIN','BGD','MANAGER','MEMBER');
create type department_type as enum ('HEAD_OFFICE','BRANCH');
create type meeting_status as enum ('DRAFT','OPEN','CLOSED','ARCHIVED');
create type conclusion_status as enum ('DRAFT','CONFIRMED');

-- ---------- DEPARTMENTS ----------
create table departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  department_type department_type not null default 'HEAD_OFFICE',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- PROFILES (1-1 with auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  department_id uuid references departments(id),
  role user_role not null default 'MEMBER',
  position text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_profiles_username on profiles(username);

-- ---------- MEETINGS ----------
create table meetings (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  summary text,
  host_department_id uuid not null references departments(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  visibility_duration_hours integer not null default 48, -- null = không giới hạn
  visible_until timestamptz,
  status meeting_status not null default 'DRAFT',
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint valid_meeting_time check (end_at > start_at)
);

create or replace function set_visible_until() returns trigger as $$
begin
  if new.visibility_duration_hours is null then
    new.visible_until := null; -- không giới hạn
  else
    new.visible_until := new.end_at + (new.visibility_duration_hours || ' hours')::interval;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_meetings_visible_until
before insert or update of end_at, visibility_duration_hours on meetings
for each row execute function set_visible_until();

-- ---------- MEETING <-> DEPARTMENT PERMISSIONS ----------
create table meeting_departments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  can_view boolean default true,
  can_comment boolean default false,
  created_at timestamptz default now(),
  unique(meeting_id, department_id)
);

-- ---------- DOCUMENTS ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  title text not null,
  description text,
  owner_department_id uuid not null references departments(id),
  status text default 'ACTIVE',
  current_version integer default 1,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number integer not null,
  file_name text not null,
  storage_path text not null, -- đường dẫn tương đối trên server vật lý
  mime_type text,
  file_size bigint,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  unique(document_id, version_number)
);

-- ---------- COMMENTS ----------
create table meeting_comments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  department_id uuid not null references departments(id),
  user_id uuid not null references profiles(id),
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references meeting_comments(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz default now()
);

-- ---------- CONCLUSIONS ----------
create table meeting_conclusions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid unique not null references meetings(id) on delete cascade,
  content text,
  status conclusion_status default 'DRAFT',
  created_by uuid not null references profiles(id),
  confirmed_by uuid references profiles(id),
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

create table conclusion_versions (
  id uuid primary key default gen_random_uuid(),
  conclusion_id uuid not null references meeting_conclusions(id) on delete cascade,
  content text,
  edited_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

-- ---------- AUDIT LOG ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ---------- INDEXES ----------
create index idx_meetings_visible_until on meetings(visible_until);
create index idx_meetings_status on meetings(status);
create index idx_meeting_departments_dept on meeting_departments(department_id);
create index idx_documents_meeting on documents(meeting_id);
create index idx_document_versions_doc on document_versions(document_id);
create index idx_comments_meeting on meeting_comments(meeting_id);
create index idx_audit_entity on audit_logs(entity_type, entity_id);

-- Full text search
alter table meetings add column search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(code,'') || ' ' || coalesce(title,'') || ' ' || coalesce(summary,''))
  ) stored;
create index idx_meetings_search on meetings using gin(search_vector);

-- ============================================================
-- HELPER FUNCTIONS (dùng trong RLS)
-- ============================================================
create or replace function current_profile()
returns profiles as $$
  select * from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function is_admin() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'ADMIN' and active);
$$ language sql stable security definer;

create or replace function is_bgd() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and role in ('ADMIN','BGD') and active);
$$ language sql stable security definer;

create or replace function my_department_id() returns uuid as $$
  select department_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function can_view_meeting(m_id uuid) returns boolean as $$
  select is_bgd()
    or exists(
      select 1 from meetings mt
      where mt.id = m_id and mt.host_department_id = my_department_id()
    )
    or exists(
      select 1 from meeting_departments md
      where md.meeting_id = m_id and md.department_id = my_department_id() and md.can_view
    );
$$ language sql stable security definer;

create or replace function can_comment_meeting(m_id uuid) returns boolean as $$
  select is_bgd()
    or exists(
      select 1 from meetings mt
      where mt.id = m_id and mt.host_department_id = my_department_id()
    )
    or exists(
      select 1 from meeting_departments md
      where md.meeting_id = m_id and md.department_id = my_department_id() and md.can_comment
    );
$$ language sql stable security definer;

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

-- Người tạo cuộc họp, khi cuộc họp còn ở trạng thái Nháp (DRAFT). Dùng để giới hạn
-- việc sửa/xoá nội dung (tài liệu, ý kiến, tệp đính kèm) và xoá hẳn cuộc họp.
create or replace function is_draft_meeting_creator(m_id uuid) returns boolean as $$
  select exists(
    select 1 from meetings mt
    where mt.id = m_id and mt.status = 'DRAFT' and mt.created_by = auth.uid()
  );
$$ language sql stable security definer;

-- ============================================================
-- RLS
-- ============================================================
alter table departments enable row level security;
alter table profiles enable row level security;
alter table meetings enable row level security;
alter table meeting_departments enable row level security;
alter table documents enable row level security;
alter table document_versions enable row level security;
alter table meeting_comments enable row level security;
alter table comment_attachments enable row level security;
alter table meeting_conclusions enable row level security;
alter table conclusion_versions enable row level security;
alter table audit_logs enable row level security;

-- Departments: mọi user đã đăng nhập đều đọc được (để hiển thị filter, form...)
create policy "departments_select_all" on departments for select using (auth.uid() is not null);
create policy "departments_write_admin" on departments for all using (is_admin()) with check (is_admin());

-- Profiles: user xem chính mình + cùng phòng ban; admin/bgd xem tất cả
create policy "profiles_select" on profiles for select using (
  id = auth.uid() or is_bgd() or department_id = my_department_id()
);
create policy "profiles_update_self" on profiles for update using (id = auth.uid());
create policy "profiles_admin_all" on profiles for all using (is_admin()) with check (is_admin());

-- Meetings: chỉ xem được nếu can_view_meeting; luôn được xem (search không lọc visible_until)
create policy "meetings_select" on meetings for select using (can_view_meeting(id));
create policy "meetings_insert" on meetings for insert with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.active)
  and (
    is_bgd() -- ADMIN/BGD: được tạo họp chủ trì bởi bất kỳ phòng ban nào
    or host_department_id = my_department_id() -- MANAGER/MEMBER: chỉ phòng của chính mình
  )
);
create policy "meetings_update" on meetings for update using (can_manage_meeting(id));
-- Xoá hẳn cuộc họp: CHỈ Quản trị viên (ADMIN), và CHỈ khi còn ở trạng thái Nháp (DRAFT).
-- Cuộc họp đang diễn ra (OPEN) hoặc đã đóng/lưu trữ (CLOSED/ARCHIVED) KHÔNG được xoá
-- dưới bất kỳ hình thức nào — dùng meetings_update để "huỷ" (đổi status) thay vì xoá.
create policy "meetings_delete" on meetings for delete using (
  is_admin() and status = 'DRAFT'
);

-- meeting_departments: xem nếu xem được cuộc họp; sửa nếu quản lý được cuộc họp
create policy "md_select" on meeting_departments for select using (can_view_meeting(meeting_id));
create policy "md_write" on meeting_departments for all using (can_manage_meeting(meeting_id)) with check (can_manage_meeting(meeting_id));

-- documents: xem nếu xem được cuộc họp; tạo mới nếu có quyền góp ý (can_comment); SỬA/XOÁ
-- (nội dung đã có) chỉ ADMIN hoặc người tạo/chủ trì phòng họp khi cuộc họp còn Nháp.
create policy "documents_select" on documents for select using (can_view_meeting(meeting_id));
create policy "documents_insert" on documents for insert with check (can_comment_meeting(meeting_id));
create policy "documents_update" on documents for update using (
  is_admin() or is_draft_meeting_creator(meeting_id)
);
create policy "documents_delete" on documents for delete using (
  is_admin() or is_draft_meeting_creator(meeting_id)
);

-- document_versions: thêm version mới (= sửa tài liệu) cho phép nếu có quyền góp ý
-- (dùng chung cho việc tạo version 1 lúc upload) HOẶC là ADMIN/người tạo họp khi còn Nháp
-- (áp dụng cho việc thêm version SAU, tức "sửa" tài liệu đã có — lớp Server Action
-- (lib/permissions -> canAddVersion) chịu trách nhiệm phân biệt rạch ròi 2 trường hợp này).
create policy "doc_versions_select" on document_versions for select using (
  can_view_meeting((select meeting_id from documents where id = document_id))
);
create policy "doc_versions_insert" on document_versions for insert with check (
  can_comment_meeting((select meeting_id from documents where id = document_id))
  or is_admin()
  or is_draft_meeting_creator((select meeting_id from documents where id = document_id))
);
create policy "doc_versions_delete" on document_versions for delete using (
  is_admin()
  or is_draft_meeting_creator((select meeting_id from documents where id = document_id))
);

-- comments: xem nếu xem được cuộc họp; tạo mới nếu có quyền góp ý; XOÁ chỉ ADMIN hoặc
-- người tạo/chủ trì phòng họp khi cuộc họp còn Nháp (không còn cho chính chủ ý kiến tự xoá
-- tuỳ ý như trước, để khớp quy tắc "khoá nội dung" khi cuộc họp đã rời trạng thái Nháp).
create policy "comments_select" on meeting_comments for select using (can_view_meeting(meeting_id));
create policy "comments_insert" on meeting_comments for insert with check (can_comment_meeting(meeting_id));
create policy "comments_update_own" on meeting_comments for update using (user_id = auth.uid());
create policy "comments_delete" on meeting_comments for delete using (
  is_admin() or is_draft_meeting_creator(meeting_id)
);

-- comment attachments
create policy "comment_att_select" on comment_attachments for select using (
  can_view_meeting((select meeting_id from meeting_comments where id = comment_id))
);
create policy "comment_att_insert" on comment_attachments for insert with check (
  exists(select 1 from meeting_comments c where c.id = comment_id and c.user_id = auth.uid())
);
create policy "comment_att_delete" on comment_attachments for delete using (
  is_admin()
  or is_draft_meeting_creator((select meeting_id from meeting_comments where id = comment_id))
);

-- conclusions: xem nếu xem được meeting; soạn/sửa nếu quản lý được meeting; xác nhận chỉ BGD
create policy "conclusion_select" on meeting_conclusions for select using (can_view_meeting(meeting_id));
create policy "conclusion_write" on meeting_conclusions for insert with check (can_manage_meeting(meeting_id));
create policy "conclusion_update" on meeting_conclusions for update using (
  can_manage_meeting(meeting_id) or (is_bgd() and status = 'DRAFT')
);
create policy "conclusion_versions_select" on conclusion_versions for select using (
  can_view_meeting((select meeting_id from meeting_conclusions where id = conclusion_id))
);
create policy "conclusion_versions_insert" on conclusion_versions for insert with check (
  can_manage_meeting((select meeting_id from meeting_conclusions where id = conclusion_id))
);

-- audit_logs: chỉ admin xem, mọi user backend (service role) ghi được
create policy "audit_select_admin" on audit_logs for select using (is_admin());
create policy "audit_insert_authenticated" on audit_logs for insert with check (auth.uid() is not null);

-- ============================================================
-- SEED DỮ LIỆU MẪU (tuỳ chọn — xoá nếu không cần)
-- ============================================================
insert into departments (code, name, department_type) values
 ('BGD','Ban Giám đốc','HEAD_OFFICE'),
 ('TCHC','Tổ chức Hành chính','HEAD_OFFICE'),
 ('KETOAN','Kế toán','HEAD_OFFICE'),
 ('PGD01','Phòng giao dịch 01','BRANCH'),
 ('PGD02','Phòng giao dịch 02','BRANCH');
