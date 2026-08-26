'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting, MeetingDepartment, MeetingParticipant } from '@/types/meeting';
import type { Department } from '@/types/user';
import {
  updateMeetingDepartmentsAction,
  updateMeetingStatusAction,
  deleteMeetingAction
} from '@/actions/meeting.actions';

export default function TabInfo({
  meeting,
  perms,
  participants = [],
  allDepartments,
  canManage,
  canDelete
}: {
  meeting: Meeting;
  perms: MeetingDepartment[];
  participants?: (MeetingParticipant & { profiles?: { full_name: string; position: string | null } })[];
  allDepartments: Department[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [rows, setRows] = useState(
    allDepartments.map((d) => {
      const existing = perms.find((p) => p.department_id === d.id);
      return {
        department_id: d.id,
        name: d.name,
        can_view: existing?.can_view ?? false,
        can_comment: existing?.can_comment ?? false
      };
    })
  );
  const [isPending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  const [isApproving, startApproveTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  function toggle(id: string, field: 'can_view' | 'can_comment') {
    setRows((prev) => prev.map((r) => (r.department_id === id ? { ...r, [field]: !r[field] } : r)));
  }

  // "Chọn tất cả" theo từng cột (Xem / Ý kiến) — bấm 1 lần để bật hết, bấm lại để tắt hết.
  // Ô đầu bảng tự chuyển sang trạng thái "chưa xác định" (indeterminate) khi chỉ một phần được chọn.
  const allViewChecked = rows.length > 0 && rows.every((r) => r.can_view);
  const allCommentChecked = rows.length > 0 && rows.every((r) => r.can_comment);
  const someViewChecked = rows.some((r) => r.can_view);
  const someCommentChecked = rows.some((r) => r.can_comment);

  function toggleAll(field: 'can_view' | 'can_comment') {
    const next = field === 'can_view' ? !allViewChecked : !allCommentChecked;
    setRows((prev) => prev.map((r) => ({ ...r, [field]: next })));
  }

  function save() {
    setSavedMsg(null);
    startTransition(async () => {
      const res = await updateMeetingDepartmentsAction(
        meeting.id,
        rows.filter((r) => r.can_view || r.can_comment).map(({ department_id, can_view, can_comment }) => ({
          department_id,
          can_view,
          can_comment
        }))
      );
      setSavedMsg(res?.error ?? 'Đã lưu phân quyền.');
    });
  }

  // Duyệt: chuyển Nháp -> Mở, để các phòng ban được phân quyền bắt đầu nhìn thấy cuộc họp.
  function handleApprove() {
    setApproveMsg(null);
    startApproveTransition(async () => {
      const res = await updateMeetingStatusAction(meeting.id, 'OPEN');
      if (res?.error) setApproveMsg(res.error);
    });
  }

  // Huỷ sớm (ngoại lệ): dùng khi cuộc họp bị huỷ TRƯỚC/TRONG khi diễn ra — khác với việc
  // hệ thống tự động chuyển "Đã đóng" 48h SAU khi cuộc họp kết thúc (không cần bấm tay).
  function handleCancel() {
    if (!confirm('Huỷ cuộc họp này? Trạng thái sẽ chuyển sang "Lưu trữ", dữ liệu vẫn được giữ lại.')) return;
    startCancelTransition(async () => {
      await updateMeetingStatusAction(meeting.id, 'ARCHIVED');
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Xoá HẲN cuộc họp "${meeting.title}"?\n\n` +
          'Hành động này KHÔNG THỂ hoàn tác — toàn bộ tài liệu, ý kiến và kết luận ' +
          'gắn với cuộc họp sẽ bị xoá theo. Nếu chỉ muốn dừng hiệu lực mà vẫn giữ dữ liệu, hãy dùng nút "Huỷ cuộc họp" thay vì xoá.'
      )
    )
      return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteMeetingAction(meeting.id);
      if (res?.error) {
        setDeleteError(res.error);
        return;
      }
      router.push('/meetings');
    });
  }

  const canCancel = canManage && (meeting.status === 'OPEN' || meeting.status === 'DRAFT');

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <h3 className="font-semibold mb-2">Tóm tắt</h3>
        <p className="text-sm text-inksoft whitespace-pre-wrap">{meeting.summary || '—'}</p>
      </div>

      {meeting.meeting_type === 'EXTERNAL' && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Thông tin họp ngoài ngành</h3>
          <p className="text-sm text-inksoft mb-2">
            <span aria-hidden>📍</span> Địa điểm: {meeting.location || '— chưa xác định'}
          </p>
          <p className="text-sm font-medium mb-1.5">Người được cử đi tham dự</p>
          {participants.length === 0 ? (
            <p className="text-sm text-inksoft">Chưa tag người nào.</p>
          ) : (
            <ul className="space-y-1">
              {participants.map((p) => (
                <li key={p.id} className="text-sm text-inksoft">
                  🧑‍💼 {p.profiles?.full_name ?? 'Người dùng'}
                  {p.profiles?.position ? ` — ${p.profiles.position}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card p-4">
        <h3 className="font-semibold mb-2">Hiển thị</h3>
        <p className="text-sm text-inksoft">
          {meeting.visible_until
            ? `Tự ẩn khỏi Trang chủ sau ${new Date(meeting.visible_until).toLocaleString('vi-VN')} (dữ liệu vẫn giữ nguyên, tìm được qua Tìm kiếm).`
            : 'Không giới hạn thời gian hiển thị.'}
        </p>
      </div>

      {/* Nháp -> Duyệt: chỉ 1 bước duyệt duy nhất, không có nút "Đóng"/"Lưu trữ" thủ công —
          hệ thống tự chuyển "Đã đóng" 48 giờ sau khi cuộc họp kết thúc (xem cron auto-close-meetings). */}
      {canManage && meeting.status === 'DRAFT' && (
        <div className="card p-4 border-gold/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge-draft">📝 Nháp</span>
            <h3 className="font-semibold">Cuộc họp đang ở dạng Nháp</h3>
          </div>
          <p className="text-sm text-inksoft mb-3">
            Hiện chỉ mình bạn thấy được cuộc họp này. Kiểm tra lại thông tin và{' '}
            <span className="font-medium text-ink">Phân quyền phòng tham gia</span> bên dưới, sau đó bấm
            "Duyệt tạo cuộc họp" để các phòng ban được phân quyền bắt đầu nhìn thấy.
          </p>
          <button onClick={handleApprove} disabled={isApproving} className="btn-primary">
            {isApproving && <span className="spinner" />}
            {isApproving ? 'Đang duyệt…' : '✅ Duyệt tạo cuộc họp'}
          </button>
          {approveMsg && <p className="text-sm text-red mt-2">{approveMsg}</p>}
        </div>
      )}

      {canManage && meeting.status !== 'DRAFT' && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Trạng thái cuộc họp</h3>
          <p className="text-sm text-inksoft">
            Cuộc họp đã được duyệt và các phòng ban được phân quyền có thể xem. Hệ thống sẽ{' '}
            <span className="font-medium text-ink">tự động chuyển sang "Đã đóng"</span> 48 giờ sau khi cuộc
            họp kết thúc — không cần thao tác thủ công.
          </p>
          {canCancel && (
            <>
              <button onClick={handleCancel} disabled={isCancelling} className="btn mt-3 text-red border-red/30">
                {isCancelling && <span className="spinner" />}
                {isCancelling ? 'Đang huỷ…' : 'Huỷ cuộc họp'}
              </button>
              <p className="text-xs text-inksoft mt-1.5">
                Chỉ dùng khi cuộc họp bị huỷ trước hoặc trong lúc diễn ra (VD: hoãn đột xuất) — khác với việc
                tự động đóng sau khi kết thúc ở trên.
              </p>
            </>
          )}
        </div>
      )}

      {canDelete && (
        <div className="card p-4 border-red/30">
          <h3 className="font-semibold mb-2 text-red">Vùng nguy hiểm (Quản trị viên)</h3>
          <p className="text-sm text-inksoft mb-3">
            Xoá hẳn cuộc họp nháp này khỏi hệ thống, kèm theo toàn bộ tài liệu, ý kiến, kết luận liên
            quan. Chỉ áp dụng cho cuộc họp còn ở trạng thái Nháp — cuộc họp đang diễn ra hoặc đã đóng/lưu
            trữ sẽ không thể xoá được nữa. Không thể khôi phục sau khi xoá.
          </p>
          <button onClick={handleDelete} disabled={isDeleting} className="btn-danger">
            {isDeleting ? 'Đang xoá...' : 'Xoá cuộc họp'}
          </button>
          {deleteError && <p className="text-sm text-red mt-2">{deleteError}</p>}
        </div>
      )}

      {canManage && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Phân quyền phòng tham gia</h3>

          {/* Hàng tiêu đề: chọn tất cả / bỏ chọn tất cả theo từng cột */}
          <div className="flex items-center justify-between text-xs font-semibold text-inksoft py-1.5 border-b border-line">
            <span>Chọn tất cả</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allViewChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someViewChecked && !allViewChecked;
                  }}
                  onChange={() => toggleAll('can_view')}
                />
                Xem
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allCommentChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someCommentChecked && !allCommentChecked;
                  }}
                  onChange={() => toggleAll('can_comment')}
                />
                Ý kiến
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.department_id} className="flex items-center justify-between text-sm py-1.5 border-b border-line last:border-0">
                <span>{r.name}</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={r.can_view} onChange={() => toggle(r.department_id, 'can_view')} />
                    Xem
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={r.can_comment} onChange={() => toggle(r.department_id, 'can_comment')} />
                    Ý kiến
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={isPending} className="btn-primary mt-3">
            {isPending && <span className="spinner" />}
            {isPending ? 'Đang lưu…' : 'Lưu phân quyền'}
          </button>
          {savedMsg && <p className="text-sm text-inksoft mt-2">{savedMsg}</p>}
        </div>
      )}
    </div>
  );
}
