import Link from 'next/link';
import type { Profile } from '@/types/user';
import RoleBadge from '@/components/ui/role-badge';
import LogoutButton from '@/components/dashboard/logout-button';

export default function TopBar({
  profile,
  departmentName
}: {
  profile: Profile;
  departmentName?: string | null;
}) {
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-surface sticky top-0 z-10">
      <Link href="/account">
        <div className="text-sm font-semibold">{profile.full_name}</div>
        <div className="text-xs text-inksoft">{departmentName}</div>
      </Link>
      <div className="flex items-center gap-2">
        <RoleBadge role={profile.role} />
        <LogoutButton compact />
      </div>
    </header>
  );
}
