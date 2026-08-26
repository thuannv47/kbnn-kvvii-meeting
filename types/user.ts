export type UserRole = 'ADMIN' | 'BGD' | 'MANAGER' | 'MEMBER';

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  department_id: string | null;
  role: UserRole;
  position: string | null;
  active: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  department_type: 'HEAD_OFFICE' | 'BRANCH';
  active: boolean;
}
