import type { Profile } from '@/types/user';
import type { Meeting, MeetingDepartment, DocumentRow, MeetingConclusion } from '@/types/meeting';

/**
 * QUAN TRỌNG: các hàm dưới đây chỉ dùng để ẨN/HIỆN nút trên UI
 * và để Server Action từ chối sớm (fail-fast) trước khi động tới DB.
 * Lớp phòng thủ CUỐI CÙNG luôn là Supabase RLS (xem supabase/migrations/0001_init.sql).
 * -> Không bao giờ được tin tưởng tuyệt đối vào các hàm này.
 */

export function isAdmin(u?: Profile | null) {
  return !!u && u.role === 'ADMIN';
}

export function isBGD(u?: Profile | null) {
  return !!u && (u.role === 'ADMIN' || u.role === 'BGD');
}

export function isManagerOf(u: Profile | null | undefined, departmentId: string) {
  return !!u && u.role === 'MANAGER' && u.department_id === departmentId;
}

/**
 * Bất kỳ tài khoản nào đang hoạt động (active) đều được phép TẠO cuộc họp,
 * không chỉ riêng ADMIN/BGD/MANAGER. Việc "chủ trì phòng nào" mới bị giới hạn
 * (xem canHostDepartment) để tránh một nhân viên tạo cuộc họp nhân danh phòng ban khác.
 */
export function canCreateMeeting(u?: Profile | null) {
  // Khớp nghiêm ngặt với điều kiện RLS "and p.active" ở policy meetings_insert:
  // null/undefined KHÔNG được coi là hợp lệ, chỉ true mới được.
  return !!u && u.active === true;
}

/**
 * Phòng ban nào user được phép chọn làm "Phòng chủ trì" khi tạo cuộc họp.
 * - ADMIN/BGD: được chọn bất kỳ phòng ban nào (điều phối liên phòng).
 * - MANAGER/MEMBER: chỉ được chọn đúng phòng ban của mình.
 */
export function canHostDepartment(u: Profile | null | undefined, departmentId: string) {
  if (!u) return false;
  if (isBGD(u)) return true;
  return !!u.department_id && u.department_id === departmentId;
}

export function canViewMeeting(
  meeting: Meeting,
  perms: MeetingDepartment[],
  u?: Profile | null
) {
  if (!u) return false;
  if (isBGD(u)) return true;
  if (meeting.host_department_id === u.department_id) return true;
  return perms.some((p) => p.department_id === u.department_id && p.can_view);
}

export function canCommentMeeting(
  meeting: Meeting,
  perms: MeetingDepartment[],
  u?: Profile | null
) {
  if (!u) return false;
  if (isBGD(u)) return true;
  if (meeting.host_department_id === u.department_id) return true;
  return perms.some((p) => p.department_id === u.department_id && p.can_comment);
}

export function canManageMeeting(meeting: Meeting, u?: Profile | null) {
  if (!u) return false;
  if (isAdmin(u)) return true;
  if (meeting.created_by === u.id) return true; // người tạo luôn quản lý được cuộc họp của mình
  return meeting.host_department_id === u.department_id && (u.role === 'MANAGER' || u.role === 'BGD');
}

/**
 * Xoá hẳn cuộc họp (khác với "huỷ" — tức đổi status sang CLOSED/ARCHIVED).
 * QUY TẮC MỚI: chỉ ADMIN mới được xoá, và CHỈ khi cuộc họp còn ở trạng thái NHÁP (DRAFT).
 * Cuộc họp đang diễn ra (OPEN) hoặc đã đóng/lưu trữ (CLOSED/ARCHIVED) thì KHÔNG ai được xoá,
 * kể cả ADMIN hay người tạo — muốn dừng hiệu lực thì dùng chức năng "Huỷ cuộc họp" (đổi trạng
 * thái) để vẫn giữ lại hồ sơ/lịch sử.
 */
export function canDeleteMeeting(meeting: Meeting, u?: Profile | null) {
  return isAdmin(u) && meeting.status === 'DRAFT';
}

/**
 * "Huỷ" cuộc họp = chuyển trạng thái sang ARCHIVED (lưu trữ, không còn hiệu lực)
 * mà không xoá dữ liệu. Dùng lại đúng quyền quản lý cuộc họp hiện có
 * (ADMIN luôn huỷ được; người tạo / MANAGER-BGD của phòng chủ trì cũng huỷ được
 * cuộc họp do mình phụ trách).
 */
export function canCancelMeeting(meeting: Meeting, u?: Profile | null) {
  return canManageMeeting(meeting, u);
}

export function isMeetingCreator(meeting: Meeting, u?: Profile | null) {
  return !!u && meeting.created_by === u.id;
}

/**
 * QUY TẮC MỚI: khi cuộc họp còn ở trạng thái NHÁP (DRAFT), CHỈ người tạo/chủ trì
 * phòng họp mới có quyền SỬA (thêm version tài liệu) hoặc XOÁ nội dung đã có
 * (tài liệu, ý kiến, tệp đính kèm) — các thành viên/phòng ban khác dù có quyền
 * xem/góp ý (can_comment) vẫn KHÔNG được sửa/xoá nội dung do người khác đăng.
 * Một khi cuộc họp đã chuyển sang OPEN/CLOSED/ARCHIVED, nội dung trở thành cố định
 * (không ai sửa/xoá được nữa, kể cả người tạo) để đảm bảo tính toàn vẹn hồ sơ —
 * chỉ ADMIN được bỏ qua giới hạn này để khắc phục sự cố khi thật sự cần thiết.
 */
export function canEditMeetingContent(meeting: Meeting, u?: Profile | null) {
  if (!u) return false;
  if (isAdmin(u)) return true;
  return meeting.status === 'DRAFT' && isMeetingCreator(meeting, u);
}

export function canUploadDocument(
  meeting: Meeting,
  perms: MeetingDepartment[],
  u?: Profile | null
) {
  return canCommentMeeting(meeting, perms, u);
}

/** Thêm version mới (= sửa) cho tài liệu đã có. Xem quy tắc ở canEditMeetingContent. */
export function canAddVersion(meeting: Meeting, doc: DocumentRow, u?: Profile | null) {
  return canEditMeetingContent(meeting, u);
}

/** Xoá hẳn một tài liệu (kèm mọi version) đã đăng. Xem quy tắc ở canEditMeetingContent. */
export function canDeleteDocument(meeting: Meeting, doc: DocumentRow, u?: Profile | null) {
  return canEditMeetingContent(meeting, u);
}

/** Xoá một ý kiến/tệp đính kèm đã đăng. Xem quy tắc ở canEditMeetingContent. */
export function canDeleteComment(meeting: Meeting, u?: Profile | null) {
  return canEditMeetingContent(meeting, u);
}

export function canDraftConclusion(meeting: Meeting, u?: Profile | null) {
  return canManageMeeting(meeting, u);
}

export function canConfirmConclusion(
  conclusion: MeetingConclusion | null | undefined,
  u?: Profile | null
) {
  if (!u || !conclusion) return false;
  return isBGD(u) && conclusion.status === 'DRAFT';
}

export function canManageOrg(u?: Profile | null) {
  return isAdmin(u);
}

export function isDashboardVisible(meeting: Meeting) {
  if (!meeting.visible_until) return true; // "Không giới hạn"
  return new Date(meeting.visible_until).getTime() >= Date.now();
}
