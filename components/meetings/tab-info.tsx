'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting, MeetingDepartment, MeetingParticipant } from '@/types/meeting';
import type { Department } from '@/types/user';
import { updateMeetingStatusAction, deleteMeetingAction, updateMeetingInfoAction, checkMeetingScheduleConflictsAction } from '@/actions/meeting.actions';
import { formatDateVN, formatTimeVN } from '@/lib/format-date';
import { IconPin, IconCalendarDays, IconClock, IconUser, IconCheck, IconFile } from '@/components/ui/icons';

/** Chuyển ISO timestamp -> giá trị cho <input type="datetime-local"> (giờ địa phương, không giây). */
function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TabInfo({
  meeting,
  participants = [],
  canManage,
  canDelete,
  canDeleteAsThuky
}: {
  meeting: Meeting;
  perms?: MeetingDepartment[];
  participants?: (MeetingParticipant & { profiles?: { full_name: string; position: string | null } })[];
  allDepartments?: Department[];
  canManage: boolean;
  canDelete: boolean;
  canDeleteAsThuky: boolean;
}) {
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [thukyDeleteError, setThukyDeleteError] = useState<string | null>(null);
  const [isThukyDeleting, startThukyDeleteTransition] = useTransition();
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  const [isApproving, startApproveTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  // ---- Sửa thông tin cuộc họp (tiêu đề, thời gian, ghi chú, địa điểm) ----
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [form, setForm] = useState({
    title: meeting.title,
    summary: meeting.summary ?? '',
    location: meeting.location ?? '',
    start_at: toDatetimeLocalValue(meeting.start_at),
    end_at: toDatetimeLocalValue(meeting.end_at)
  });

  function handleSaveInfo() {
    setEditError(null);
    startSaveTransition(async () => {
      const start_at = new Date(form.start_at).toISOString();
      const end_at = new Date(form.end_at).toISOString();

      // Đổi giờ có thể phát sinh trùng lịch mới với BGĐ/Trưởng-phó phòng đã
      // được tag tham dự cuộc họp này — cảnh báo trước, không chặn lưu.
      const participantIds = participants.map((p) => p.user_id).filter(Boolean);
      if (participantIds.length > 0) {
        const conflictRes = await checkMeetingScheduleConflictsAction({
          participant_user_ids: participantIds,
          start_at,
          end_at,
          exclude_meeting_id: meeting.id
        });
        if ('conflicts' in conflictRes && conflictRes.conflicts.length > 0) {
          const lines = conflictRes.conflicts.map((c) => {
            const roleLabel = c.role === 'BGD' ? 'BGĐ' : 'Trưởng/phó phòng';
            return `• ${c.full_name} (${roleLabel}) đang bận "${c.meeting_title}" lúc ${formatTimeVN(c.start_at, {
              hour: '2-digit',
              minute: '2-digit'
            })}–${formatTimeVN(c.end_at, { hour: '2-digit', minute: '2-digit' })} ngày ${formatDateVN(c.start_at)}`;
          });
          const ok = confirm(
            `Khung giờ mới bị trùng lịch với ${conflictRes.conflicts.length} người:\n\n${lines.join('\n')}\n\n` +
              'Vẫn tiếp tục lưu thay đổi này?'
          );
          if (!ok) return;
        }
      }

      const res = await updateMeetingInfoAction(meeting.id, {
        title: form.title,
        summary: form.summary,
        location: form.location,
        start_at,
        end_at
      });
      if (res?.error) {
        setEditError(res.error);
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  }

  function handleCancelEdit() {
    setForm({
      title: meeting.title,
      summary: meeting.summary ?? '',
      location: meeting.location ?? '',
      start_at: toDatetimeLocalValue(meeting.start_at),
      end_at: toDatetimeLocalValue(meeting.end_at)
    });
    setEditError(null);
    setIsEditing(false);
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

  // Nút riêng cho Thư ký — cùng hành động xoá hẳn, nhưng được phép ở mọi trạng
  // thái (trừ Lưu trữ), khác với "Vùng nguy hiểm" bên dưới chỉ dành cho ADMIN
  // và chỉ lúc còn Nháp.
  function handleThukyDelete() {
    if (
      !confirm(
        `Xoá HẲN cuộc họp "${meeting.title}"?\n\n` +
          'Hành động này KHÔNG THỂ hoàn tác — toàn bộ tài liệu, ý kiến và kết luận ' +
          'gắn với cuộc họp sẽ bị xoá theo. Nếu chỉ muốn dừng hiệu lực mà vẫn giữ dữ liệu, hãy dùng nút "Huỷ cuộc họp" thay vì xoá.'
      )
    )
      return;
    setThukyDeleteError(null);
    startThukyDeleteTransition(async () => {
      const res = await deleteMeetingAction(meeting.id);
      if (res?.error) {
        setThukyDeleteError(res.error);
        return;
      }
      router.push('/meetings');
    });
  }

  const canCancel = canManage && (meeting.status === 'OPEN' || meeting.status === 'DRAFT');

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Thông tin cuộc họp</h3>
          {canManage && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-xs text-gold underline">
              Sửa thông tin
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-3">
            {meeting.summary && (
              <div>
                <p className="text-xs text-inksoft mb-1">Ghi chú (hiển thị dưới tiêu đề cuộc họp)</p>
                <p className="text-sm whitespace-pre-wrap">{meeting.summary}</p>
              </div>
            )}
            <div className={`space-y-2 text-sm ${meeting.summary ? 'pt-3 border-t border-line' : ''}`}>
              <div className="flex items-start gap-2">
                <IconPin size={16} className="text-inksoft flex-shrink-0 mt-0.5" />
                <span>{meeting.location || '— chưa xác định'}</span>
              </div>
              <div className="flex items-center gap-2">
                <IconCalendarDays size={16} className="text-inksoft flex-shrink-0" />
                <span className="font-medium">{formatDateVN(meeting.start_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <IconClock size={16} className="text-inksoft flex-shrink-0" />
                <span>
                  {formatTimeVN(meeting.start_at, { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {formatTimeVN(meeting.end_at, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div>
              <label className="text-xs text-inksoft mb-1 block">Tiêu đề</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-inksoft mb-1 block">
                Ghi chú (Hiển thị bên dưới tiêu đề cuộc họp)
              </label>
              <textarea
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                rows={3}
                className="input"
                placeholder="VD: Đ/c Nguyễn Văn A chủ trì cuộc họp"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs text-inksoft mb-1 block">Bắt đầu</label>
                <input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-inksoft mb-1 block">Kết thúc</label>
                <input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-inksoft mb-1 block">Địa điểm</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="input"
                placeholder="VD: Phòng họp A, tầng 3 hoặc đường link Zoom/Google Meet"
              />
            </div>
            {editError && <p className="text-sm text-red">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSaveInfo} disabled={isSaving} className="btn-primary">
                {isSaving && <span className="spinner mr-1.5" />}
                {isSaving ? 'Đang lưu…' : 'Lưu'}
              </button>
              <button onClick={handleCancelEdit} disabled={isSaving} className="btn">
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>

      {meeting.meeting_type === 'EXTERNAL' && !isEditing && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Thành phần được cử đi tham dự</h3>
          {participants.length === 0 ? (
            <p className="text-sm text-inksoft">Chưa tag người nào.</p>
          ) : (
            <ul className="space-y-2">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 text-sm">
                  <span className="w-7 h-7 rounded-full bg-paper2 flex items-center justify-center flex-shrink-0">
                    <IconUser size={14} className="text-inksoft" />
                  </span>
                  <span>
                    <span className="font-medium">{p.profiles?.full_name ?? 'Người dùng'}</span>
                    {p.profiles?.position && <span className="text-inksoft"> — {p.profiles.position}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Nháp -> Duyệt: chỉ 1 bước duyệt duy nhất, không có nút "Đóng"/"Lưu trữ" thủ công —
          hệ thống tự chuyển "Đã đóng" 48 giờ sau khi cuộc họp kết thúc (xem cron auto-close-meetings). */}
      {canManage && meeting.status === 'DRAFT' && (
        <div className="card p-4 border-gold/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge-draft">
              <IconFile size={11} aria-hidden />
              Nháp
            </span>
            <h3 className="font-semibold">Cuộc họp đang ở dạng Nháp</h3>
          </div>
          <p className="text-sm text-inksoft mb-3">
            Hiện chỉ mình bạn thấy được cuộc họp này. Kiểm tra lại thông tin, sau đó bấm
            "Duyệt tạo cuộc họp" để các phòng ban đã chọn khi tạo bắt đầu nhìn thấy.
          </p>
          <button onClick={handleApprove} disabled={isApproving} className="btn-primary">
            {isApproving ? <span className="spinner mr-1.5" /> : <IconCheck size={15} className="mr-1.5" aria-hidden />}
            {isApproving ? 'Đang duyệt…' : 'Duyệt tạo cuộc họp'}
          </button>
          {approveMsg && <p className="text-sm text-red mt-2">{approveMsg}</p>}
        </div>
      )}

      {canManage && meeting.status !== 'DRAFT' && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Trạng thái cuộc họp</h3>
          <div className="flex flex-wrap gap-2">
            {canCancel && (
              <button onClick={handleCancel} disabled={isCancelling} className="btn text-red border-red/30">
                {isCancelling && <span className="spinner" />}
                {isCancelling ? 'Đang huỷ…' : 'Huỷ cuộc họp'}
              </button>
            )}
            {canDeleteAsThuky && (
              <button onClick={handleThukyDelete} disabled={isThukyDeleting} className="btn text-red border-red/30">
                {isThukyDeleting && <span className="spinner" />}
                {isThukyDeleting ? 'Đang xoá…' : 'Xoá (Thư ký)'}
              </button>
            )}
          </div>
          {canCancel && (
            <p className="text-xs text-inksoft mt-1.5">
              Chỉ dùng khi cuộc họp bị huỷ trước hoặc trong lúc diễn ra (VD: hoãn đột xuất) — khác với việc
              tự động đóng sau khi kết thúc ở trên.
            </p>
          )}
          {thukyDeleteError && <p className="text-sm text-red mt-2">{thukyDeleteError}</p>}
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
    </div>
  );
}
