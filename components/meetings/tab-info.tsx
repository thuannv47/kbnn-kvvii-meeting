'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting, MeetingDepartment } from '@/types/meeting';
import type { Department } from '@/types/user';
import {
  updateMeetingDepartmentsAction,
  updateMeetingStatusAction,
  deleteMeetingAction
} from '@/actions/meeting.actions';

export default function TabInfo({
  meeting,
  perms,
  allDepartments,
  canManage,
  canDelete
}: {
  meeting: Meeting;
  perms: MeetingDepartment[];
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

  function toggle(id: string, field: 'can_view' | 'can_comment') {
    setRows((prev) => prev.map((r) => (r.department_id === id ? { ...r, [field]: !r[field] } : r)));
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

  function changeStatus(status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED') {
    startTransition(async () => {
      await updateMeetingStatusAction(meeting.id, status);
    });
  }

  function handleCancel() {
    if (!confirm('Huỷ cuộc họp này? Trạng thái sẽ chuyển sang "Lưu trữ", dữ liệu vẫn được giữ lại.')) return;
    startTransition(async () => {
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

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <h3 className="font-semibold mb-2">Tóm tắt</h3>
        <p className="text-sm text-inksoft whitespace-pre-wrap">{meeting.summary || '—'}</p>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-2">Hiển thị</h3>
        <p className="text-sm text-inksoft">
          {meeting.visible_until
            ? `Tự ẩn khỏi Dashboard sau ${new Date(meeting.visible_until).toLocaleString('vi-VN')} (dữ liệu vẫn giữ nguyên, tìm được qua Tìm kiếm).`
            : 'Không giới hạn thời gian hiển thị.'}
        </p>
      </div>

      {canManage && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Trạng thái cuộc họp</h3>
          <div className="flex gap-2 flex-wrap">
            {(['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={isPending}
                className={`btn ${meeting.status === s ? 'border-gold text-gold' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={handleCancel} disabled={isPending} className="btn mt-3">
            Huỷ cuộc họp
          </button>
          <p className="text-xs text-inksoft mt-1.5">
            Chuyển trạng thái sang "Lưu trữ" — dừng hiệu lực nhưng vẫn giữ nguyên dữ liệu và lịch sử.
          </p>
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
            Lưu phân quyền
          </button>
          {savedMsg && <p className="text-sm text-inksoft mt-2">{savedMsg}</p>}
        </div>
      )}
    </div>
  );
}
