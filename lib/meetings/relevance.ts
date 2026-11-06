import type { Meeting, MeetingDepartment, MeetingParticipant } from '@/types/meeting';

/**
 * "Cuộc họp liên quan đến phòng ban của người dùng" — dùng để:
 *  - Đánh dấu SAO VÀNG trên giao diện "Các cuộc họp".
 *  - Lọc danh sách hiển thị trên Dashboard (mục "Cuộc họp gần nhất").
 *
 * Một cuộc họp được coi là LIÊN QUAN đến phòng ban D nếu:
 *  1) Phòng chủ trì cuộc họp (host_department_id) chính là D — "cuộc họp gắn vào phòng ban", HOẶC
 *  2) Phòng D đã được cấp quyền xem trong phân quyền cuộc họp (meeting_departments.can_view), HOẶC
 *  3) Có ít nhất 1 người được tag/mời tham dự (meeting_participants) mà người đó thuộc phòng D
 *     — "từng cá nhân trong phòng".
 *
 * Không áp dụng cho họp Ngoài ngành (EXTERNAL) — loại này chỉ hiển thị cho người được mời đích danh,
 * không có khái niệm "liên quan theo phòng ban".
 */
export function isMeetingRelevantToDepartment(
  meeting: Pick<Meeting, 'meeting_type' | 'host_department_id'>,
  departmentId: string | null | undefined,
  opts: {
    meetingDepartments?: Pick<MeetingDepartment, 'department_id' | 'can_view'>[];
    participantDepartmentIds?: (string | null | undefined)[];
  } = {}
): boolean {
  if (!departmentId) return false;
  if (meeting.meeting_type !== 'INTERNAL') return false;

  if (meeting.host_department_id === departmentId) return true;

  const { meetingDepartments = [], participantDepartmentIds = [] } = opts;

  if (meetingDepartments.some((p) => p.department_id === departmentId && p.can_view)) return true;
  if (participantDepartmentIds.some((id) => id === departmentId)) return true;

  return false;
}

/**
 * Sắp xếp danh sách cuộc họp theo đúng quy tắc chung:
 *   1) Ngày - giờ bắt đầu (start_at), cuộc nào đến trước xếp trước.
 *   2) Nếu trùng thời gian bắt đầu, xếp theo Tên hội nghị (A → Z, không phân biệt hoa/thường,
 *      đúng thứ tự chữ cái tiếng Việt).
 * Truyền `direction: 'desc'` để đảo ngược thứ tự thời gian (mới nhất trước) khi cần,
 * quy tắc tie-break theo tên vẫn luôn là A → Z.
 */
export function sortMeetingsByStartThenTitle<T extends Pick<Meeting, 'start_at' | 'title'>>(
  meetings: T[],
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...meetings].sort((a, b) => {
    const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    if (diff !== 0) return diff * sign;
    return a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' });
  });
}
