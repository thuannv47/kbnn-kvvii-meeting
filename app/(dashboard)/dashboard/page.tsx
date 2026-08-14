import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import MeetingCard from '@/components/meetings/meeting-card';
import { canCreateMeeting } from '@/lib/permissions';

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  // Dashboard: chỉ hiện cuộc họp còn trong thời gian hiển thị (visible_until).
  // RLS đã tự lọc theo quyền xem, ở đây chỉ lọc thêm điều kiện visible_until cho Dashboard.
  const nowIso = new Date().toISOString();
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)')
    .or(`visible_until.is.null,visible_until.gte.${nowIso}`)
    .order('start_at', { ascending: true });

  const ongoing = (meetings ?? []).filter((m: any) => m.status === 'OPEN');
  const upcoming = (meetings ?? []).filter(
    (m: any) => m.status === 'DRAFT' && new Date(m.start_at) > new Date()
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Dashboard</h1>
        {canCreateMeeting(profile) && (
          <Link href="/meetings/create" className="btn-primary">
            + Tạo cuộc họp
          </Link>
        )}
      </div>

      <Section title="🔴 Cuộc họp đang diễn ra" items={ongoing} empty="Hiện không có cuộc họp nào đang diễn ra." />
      <Section title="📅 Cuộc họp sắp tới" items={upcoming} empty="Chưa có cuộc họp sắp tới." />
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: any[]; empty: string }) {
  return (
    <section>
      <h2 className="text-lg mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-inksoft">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((m) => (
            <MeetingCard key={m.id} meeting={m} departmentName={m.departments?.name} />
          ))}
        </div>
      )}
    </section>
  );
}
