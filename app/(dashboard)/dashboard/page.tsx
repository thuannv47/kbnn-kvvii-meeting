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
  const draftCount = list.filter((m) => m.status === 'DRAFT').length;

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
<<<<<<< HEAD
    // Mẫu 1 (trang trọng, hành chính): header + banner nháp + bảng gộp chung
    // trong 1 khối thẻ liền mạch, thay vì 3 khối tách rời có khoảng cách riêng.
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-5 border-b border-line bg-paper2/40">
        <div>
          <h1 className="text-2xl">Trang chủ</h1>
          <p className="text-xs text-inksoft mt-1">
            Danh sách chỉ hiển thị cuộc họp
=======
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Trang chủ</h1>
          <p className="text-xs text-inksoft mt-1">
            Danh sách chỉ hiển thị cuộc họp còn trong hạn hiển thị. Xem đầy đủ lịch sử ở mục Tìm kiếm.
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
          </p>
        </div>
        {canCreateMeeting(profile) && (
          <Link href="/meetings/create" className="btn-primary">
            + Tạo cuộc họp
          </Link>
        )}
      </div>

      {draftCount > 0 && (
<<<<<<< HEAD
        <div className="px-6 py-3 border-b border-line bg-gold/10 text-sm flex items-center gap-2">
          <span aria-hidden>📝</span>
          <span>
            Bạn có <b>{draftCount}</b> cuộc họp đang ở dạng <b>Nháp</b> 
=======
        <div className="rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 text-sm flex items-center gap-2">
          <span aria-hidden>📝</span>
          <span>
            Bạn có <b>{draftCount}</b> cuộc họp đang ở dạng <b>Nháp</b> — chỉ mình bạn thấy được. Mở
            cuộc họp (xếp đầu bảng bên dưới) để rà soát nội dung rồi bấm "Duyệt tạo cuộc họp" khi sẵn
            sàng cho các phòng ban được phân quyền xem.
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
          </span>
        </div>
      )}

      {/* Gộp chung 1 bảng: Nháp cần xử lý lên đầu, rồi đang diễn ra, sắp diễn ra, vừa kết thúc.
<<<<<<< HEAD
          Trạng thái được thể hiện qua badge (không dùng vạch màu bên trái) vì bảng đã
          nằm lồng trong card của trang, giữ giao diện gọn và trang trọng hơn. */}
=======
          Vạch màu bên trái mỗi dòng (đỏ/xanh/xám/nâu) giúp phân biệt trạng thái nhanh
          mà không cần tách bảng. */}
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
      <MeetingTable
        items={list}
        docCountByMeeting={docCountByMeeting}
        deptCountByMeeting={deptCountByMeeting}
        empty="Hiện không có cuộc họp nào trong hạn hiển thị."
        now={now}
<<<<<<< HEAD
        flat
=======
>>>>>>> 83cd80671a83520b03a76c88ee6f42c66b77dd1d
      />
    </div>
  );
}
