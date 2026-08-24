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

  // Tổng số tài liệu (trong các cuộc họp còn hạn hiển thị) để lên KPI, không hard-code.
  const totalDocs = Object.values(docCountByMeeting).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Trang chủ</h1>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-inksoft">
            Danh sách chỉ hiển thị cuộc họp còn trong hạn hiển thị. Xem đầy đủ lịch sử ở mục Tìm kiếm.
          </p>
        </div>
        {canCreateMeeting(profile) && (
          <Link href="/meetings/create" className="btn-primary">
            + Tạo cuộc họp
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon="🔴" tint="bg-red-soft" num={ongoing.length} label="Đang diễn ra" />
        <KpiCard icon="📅" tint="bg-green-soft" num={upcoming.length} label="Sắp diễn ra" />
        <KpiCard icon="✅" tint="bg-slate-soft" num={justEnded.length} label="Vừa kết thúc" />
        <KpiCard icon="📎" tint="bg-gold-soft" num={totalDocs} label="Tài liệu trong hạn" />
      </div>

      <Section
        title="Đang diễn ra"
        dotColor="bg-red"
        items={ongoing}
        empty="Chưa có cuộc họp nào đang diễn ra. Danh sách sẽ tự cập nhật khi đến giờ họp."
        emptyIcon="🔴"
        docCountByMeeting={docCountByMeeting}
      />
      <Section
        title="Sắp diễn ra"
        dotColor="bg-green"
        items={upcoming}
        empty="Chưa có cuộc họp sắp tới."
        emptyIcon="📅"
        docCountByMeeting={docCountByMeeting}
      />
      {justEnded.length > 0 && (
        <Section
          title="Vừa kết thúc (còn trong hạn hiển thị)"
          dotColor="bg-slate"
          items={justEnded}
          empty=""
          docCountByMeeting={docCountByMeeting}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  tint,
  num,
  label
}: {
  icon: string;
  tint: string;
  num: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl2 border border-line bg-surface p-3.5 shadow-card">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px] ${tint}`}>
        {icon}
      </div>
      <div>
        <div className="font-display text-xl font-semibold leading-none text-ink">{num}</div>
        <div className="mt-1 text-[10.5px] leading-tight text-inksoft">{label}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  dotColor,
  items,
  empty,
  emptyIcon,
  docCountByMeeting
}: {
  title: string;
  dotColor: string;
  items: any[];
  empty: string;
  emptyIcon?: string;
  docCountByMeeting: Record<string, number>;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 rounded-full ${dotColor}`} />
          <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        <span className="rounded-full bg-paper2 px-2.5 py-0.5 font-mono text-[10.5px] text-inksoft">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl2 border border-dashed border-line bg-white/50 p-4">
          {emptyIcon && (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-slate-soft text-[15px]">
              {emptyIcon}
            </div>
          )}
          <p className="text-[11.5px] text-inksoft">{empty}</p>
        </div>
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
