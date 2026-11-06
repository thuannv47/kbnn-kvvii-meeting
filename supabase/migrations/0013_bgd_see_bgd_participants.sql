-- ============================================================
-- BGD: khi có người của Ban Giám đốc được cử đi dự họp (nội bộ HOẶC ngoài ngành)
-- thì TOÀN BỘ thành viên phòng Ban Giám đốc đều xem được cuộc họp đó,
-- để cả Ban biết hiện tại ai đang đi dự cuộc họp nào.
-- ============================================================
-- Phòng BGD được nhận diện bằng departments.code = 'BGD' (mã seed ở 0001_init.sql).
-- Áp dụng cho MỌI thành viên phòng BGD (kể cả THUKY/MANAGER/MEMBER của phòng này),
-- không chỉ role BGD. Cuộc họp Nháp (DRAFT) vẫn ẩn với người chưa được tag
-- (role ADMIN/BGD vẫn xem được tất cả như cũ qua is_bgd()).

create or replace function bgd_member_attends(m_id uuid) returns boolean as $$
  select exists(
    select 1
    from profiles me
    join departments d on d.id = me.department_id and d.code = 'BGD'
    join meetings mt on mt.id = m_id and mt.status <> 'DRAFT'
    where me.id = auth.uid()
      and me.active
      and exists(
        select 1 from meeting_participants mp
        join profiles pp on pp.id = mp.user_id
        where mp.meeting_id = m_id and pp.department_id = d.id
      )
  );
$$ language sql stable security definer;

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
    or bgd_member_attends(m_id)
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
    or bgd_member_attends(m_id)
    or exists(
      select 1 from meeting_departments md
      join meetings mt on mt.id = md.meeting_id
      where md.meeting_id = m_id
        and md.department_id = my_department_id()
        and md.can_comment
        and mt.status <> 'DRAFT'
    );
$$ language sql stable security definer;
