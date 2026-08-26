export type MeetingStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
<<<<<<< HEAD
export type MeetingType = 'INTERNAL' | 'EXTERNAL';
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d

export interface Meeting {
  id: string;
  code: string;
  title: string;
  summary: string | null;
<<<<<<< HEAD
  /** Địa điểm diễn ra cuộc họp (VD: "UBND Tỉnh", "Phòng họp A, tầng 3", link Zoom/Meet…). Có thể để trống. */
  location: string | null;
  /** Nội bộ (do phòng ban trong hệ thống tổ chức) hay Ngoài ngành (họp bên ngoài, cử người đi tham dự). */
  meeting_type: MeetingType;
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
  host_department_id: string;
  start_at: string;
  end_at: string;
  visibility_duration_hours: number | null;
  visible_until: string | null;
  status: MeetingStatus;
  created_by: string;
  created_at: string;
}

export interface MeetingDepartment {
  id: string;
  meeting_id: string;
  department_id: string;
  can_view: boolean;
  can_comment: boolean;
}

<<<<<<< HEAD
/** Người được tag/cử đi tham dự thay — chủ yếu dùng cho họp Ngoài ngành. */
export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  assigned_by: string | null;
}

=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
export interface DocumentRow {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  owner_department_id: string;
  status: string;
  current_version: number;
  uploaded_by: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface MeetingComment {
  id: string;
  meeting_id: string;
  department_id: string;
  user_id: string;
  content: string | null;
  created_at: string;
}

export interface MeetingConclusion {
  id: string;
  meeting_id: string;
  content: string | null;
  status: 'DRAFT' | 'CONFIRMED';
  created_by: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  // File kết luận đính kèm (văn bản chính thức do chủ trì/BGĐ tải lên) —
  // khác với ô nội dung text ở trên, đây là 1 file duy nhất đại diện cho
  // kết luận cuộc họp, có thể thay thế cho tới khi được xác nhận.
  file_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  attached_by: string | null;
  attached_at: string | null;
}
