import type { UserRole } from '@/types/user';

const classByRole: Record<UserRole, string> = {
  ADMIN: 'badge-admin',
  BGD: 'badge-bgd',
  MANAGER: 'badge-manager',
  MEMBER: 'badge-member',
  THUKY: 'badge-manager'
};

const labelByRole: Record<UserRole, string> = {
  ADMIN: 'ADMIN',
  BGD: 'BGĐ',
  MANAGER: 'TRƯỞNG/PHÓ PHÒNG',
  MEMBER: 'CHUYÊN VIÊN',
  THUKY: 'THƯ KÝ'
};

export default function RoleBadge({ role }: { role: UserRole }) {
  return <span className={`badge ${classByRole[role]}`}>{labelByRole[role]}</span>;
}
