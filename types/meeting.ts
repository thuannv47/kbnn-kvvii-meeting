export type MeetingStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface Meeting {
  id: string;
  code: string;
  title: string;
  summary: string | null;
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
}
