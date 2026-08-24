import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import MeetingTable from '@/components/meetings/meeting-table';
import { canCreateMeeting } from '@/lib/permissions';
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
  // Đếm số phòng ban được phân quyền tham gia (bảng meeting_departments) —
  // không tính phòng chủ trì, vì phòng chủ trì đã hiển thị riêng ở cột khác.
  const deptCountByMeeting: Record<string, number> = {};
  if (list.length > 0) {
    const meetingIds = list.map((m) => m.id);
    const [{ data: docs }, { data: depts }] = await Promise.all([
      supabase.from('documents').select('meeting_id').in('meeting_id', meetingIds),
      supabase.from('meeting_departments').select('meeting_id').in('meeting_id', meetingIds)
    ]);
    for (const d of docs ?? []) {
      docCountByMeeting[d.meeting_id] = (docCountByMeeting[d.meeting_id] ?? 0) + 1;
    }
    for (const d of depts ?? []) {
      deptCountByMeeting[d.meeting_id] = (deptCountByMeeting[d.meeting_id] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Trang chủ</h1>
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

      {/* Gộp chung 1 bảng: đang diễn ra lên đầu, rồi sắp diễn ra, rồi vừa kết thúc.
          Vạch màu bên trái mỗi dòng (đỏ/xanh/xám) giúp phân biệt trạng thái nhanh
          mà không cần tách bảng. */}
      <MeetingTable
        items={list}
        docCountByMeeting={docCountByMeeting}
        deptCountByMeeting={deptCountByMeeting}
        empty="Hiện không có cuộc họp nào trong hạn hiển thị."
        now={now}
      />
    </div>
  );
}
