import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import MeetingCard from '@/components/meetings/meeting-card';
import { canCreateMeeting } from '@/lib/permissions';
import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import type { Meeting } from '@/types/meeting';

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  // Dashboard: chỉ hiện cuộc họp còn trong thời gian hiển thị (visible_until).
  // RLS đã tự lọc theo quyền xem, ở đây chỉ lọc thêm điều kiện visible_until cho Dashboard.
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso);
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)')
    .or(`visible_until.is.null,visible_until.gte.${nowIso}`)
    .order('start_at', { ascending: true });

  const list = (meetings ?? []) as (Meeting & { departments?: { name: string } })[];

  // Đếm số tài liệu thật của từng cuộc họp (RLS vẫn áp dụng, chỉ đếm những
  // dòng documents mà user hiện tại có quyền xem) để hiển thị đúng trên card,
  // thay vì hard-code 0 như trước.
  const docCountByMeeting: Record<string, number> = {};
  if (list.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('meeting_id')
      .in(
        'meeting_id',
        list.map((m) => m.id)
      );
    for (const d of docs ?? []) {
      docCountByMeeting[d.meeting_id] = (docCountByMeeting[d.meeting_id] ?? 0) + 1;
    }
  }

  // Trạng thái hiển thị được tính theo THỜI GIAN THỰC (start_at/end_at so với hiện tại),
  // không chỉ dựa vào cột status trong DB — để "Đang diễn ra" đúng đúng ngày giờ diễn ra,
  // còn cuộc họp chưa tới ngày sẽ hiển thị "Sắp diễn ra".
  const ongoing = list.filter((m) => getMeetingDisplayStatus(m, now).key === 'LIVE');
  const upcoming = list
    .filter((m) => getMeetingDisplayStatus(m, now).key === 'UPCOMING')
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const justEnded = list
    .filter((m) => getMeetingDisplayStatus(m, now).key === 'DONE')
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime());

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Dashboard</h1>
          <p className="text-xs text-inksoft mt-1">
            Danh sách chỉ hiển thị cuộc họp còn trong hạn hiển thị. Xem đầy đủ lịch sử ở mục Tìm kiếm.
          </p>
        </div>
        {canCreateMeeting(profile) && (
          <Link href="/meetings/create" className="btn-primary">
            + Tạo cuộc họp
          </Link>
        )}
      </div>

      <Section
        title="🔴 Đang diễn ra"
        items={ongoing}
        empty="Hiện không có cuộc họp nào đang diễn ra."
        docCountByMeeting={docCountByMeeting}
      />
      <Section
        title="📅 Sắp diễn ra"
        items={upcoming}
        empty="Chưa có cuộc họp sắp tới."
        docCountByMeeting={docCountByMeeting}
      />
      {justEnded.length > 0 && (
        <Section
          title="✅ Vừa kết thúc (còn trong hạn hiển thị)"
          items={justEnded}
          empty=""
          docCountByMeeting={docCountByMeeting}
        />
      )}
    </div>
  );
}

function Section({
  title,
  items,
  empty,
  docCountByMeeting
}: {
  title: string;
  items: any[];
  empty: string;
  docCountByMeeting: Record<string, number>;
}) {
  return (
    <section>
      <h2 className="text-lg mb-3 font-display font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-inksoft">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              departmentName={m.departments?.name}
              docCount={docCountByMeeting[m.id] ?? 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
