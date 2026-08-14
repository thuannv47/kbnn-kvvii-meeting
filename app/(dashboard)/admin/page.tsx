import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';

export default async function AdminPage() {
  const { profile } = await requireUser();
  if (!canManageOrg(profile)) redirect('/dashboard');

  const supabase = createServerSupabase();
  const [{ count: meetingCount }, { count: userCount }, { count: docCount }, { count: auditCount }] =
    await Promise.all([
      supabase.from('meetings').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true })
    ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">Quản trị hệ thống</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Cuộc họp" value={meetingCount} />
        <Stat label="Người dùng" value={userCount} />
        <Stat label="Tài liệu" value={docCount} />
        <Stat label="Bản ghi audit" value={auditCount} />
      </div>

      <Link href="/admin/audit" className="btn-primary inline-flex">
        Xem Audit Log →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-display font-semibold">{value ?? 0}</p>
      <p className="text-xs text-inksoft">{label}</p>
    </div>
  );
}
