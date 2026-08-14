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
  department_id uuid references departments(id),
  role user_role not null default 'MEMBER',
  position text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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
      select 1 from meetings mt
      join profiles p on p.id = auth.uid()
      where mt.id = m_id
        and mt.host_department_id = p.department_id
        and p.role in ('MANAGER','BGD')
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
  is_admin() or (
    exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('MANAGER','BGD'))
  )
);
create policy "meetings_update" on meetings for update using (can_manage_meeting(id));
create policy "meetings_delete" on meetings for delete using (is_admin());

-- meeting_departments: xem nếu xem được cuộc họp; sửa nếu quản lý được cuộc họp
create policy "md_select" on meeting_departments for select using (can_view_meeting(meeting_id));
create policy "md_write" on meeting_departments for all using (can_manage_meeting(meeting_id)) with check (can_manage_meeting(meeting_id));

-- documents
create policy "documents_select" on documents for select using (can_view_meeting(meeting_id));
create policy "documents_insert" on documents for insert with check (can_comment_meeting(meeting_id));
create policy "documents_update" on documents for update using (
  can_manage_meeting(meeting_id) or owner_department_id = my_department_id()
);
create policy "documents_delete" on documents for delete using (can_manage_meeting(meeting_id));

-- document_versions
create policy "doc_versions_select" on document_versions for select using (
  can_view_meeting((select meeting_id from documents where id = document_id))
);
create policy "doc_versions_insert" on document_versions for insert with check (
  can_comment_meeting((select meeting_id from documents where id = document_id))
);

-- comments
create policy "comments_select" on meeting_comments for select using (can_view_meeting(meeting_id));
create policy "comments_insert" on meeting_comments for insert with check (can_comment_meeting(meeting_id));
create policy "comments_update_own" on meeting_comments for update using (user_id = auth.uid());
create policy "comments_delete" on meeting_comments for delete using (user_id = auth.uid() or is_admin());

-- comment attachments
create policy "comment_att_select" on comment_attachments for select using (
  can_view_meeting((select meeting_id from meeting_comments where id = comment_id))
);
create policy "comment_att_insert" on comment_attachments for insert with check (
  exists(select 1 from meeting_comments c where c.id = comment_id and c.user_id = auth.uid())
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
