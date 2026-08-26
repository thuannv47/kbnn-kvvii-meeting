-- ============================================================
-- Thêm vai trò THƯ KÝ (THUKY) vào enum user_role.
-- ============================================================
-- Phải tách RIÊNG thành 1 migration độc lập: Postgres không cho phép dùng
-- giá trị enum vừa thêm (ALTER TYPE ... ADD VALUE) trong CÙNG một transaction/
-- migration — nếu gộp chung với các câu lệnh dùng 'THUKY' ngay bên dưới sẽ báo
-- lỗi "unsafe use of new value of enum type". Xem tiếp logic quyền hạn ở
-- migration 0010_thuky_permissions.sql.

alter type user_role add value if not exists 'THUKY';
