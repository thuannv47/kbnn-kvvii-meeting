'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMeetingAction } from '@/actions/meeting.actions';
import type { Department } from '@/types/user';

const VISIBILITY_OPTIONS = [
  { label: '48 giờ', value: 48 },
  { label: '72 giờ', value: 72 },
  { label: '7 ngày', value: 24 * 7 },
  { label: '30 ngày', value: 24 * 30 },
  { label: 'Không giới hạn', value: '' }
];

export default function CreateMeetingForm({
  departments,
  defaultDepartmentId,
  canPickAnyDepartment
}: {
  departments: Department[];
  defaultDepartmentId: string;
  canPickAnyDepartment: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>(departments.map((d) => d.id));
  const [isPending, startTransition] = useTransition();

  function toggleDept(id: string) {
    setSelectedDepts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const allSelected = departments.length > 0 && selectedDepts.length === departments.length;

  function toggleAll() {
    setSelectedDepts(allSelected ? [] : departments.map((d) => d.id));
  }

  // Luôn tạo ở dạng NHÁP — người khác chưa thấy được. Sau khi tạo, vào chi tiết
  // cuộc họp và bấm "Duyệt tạo cuộc họp" khi đã sẵn sàng cho các phòng được
  // phân quyền xem. Không cho chọn trạng thái ngay lúc tạo để tránh bỏ qua bước
  // kiểm tra lại thông tin/phân quyền trước khi mở.
  function submit(formData: FormData) {
    setError(null);
    const visRaw = String(formData.get('visibility_duration_hours') || '');
    startTransition(async () => {
      const res = await createMeetingAction({
        title: String(formData.get('title') || ''),
        summary: String(formData.get('summary') || ''),
        host_department_id: String(formData.get('host_department_id') || ''),
        start_at: String(formData.get('start_at') || ''),
        end_at: String(formData.get('end_at') || ''),
        visibility_duration_hours: visRaw === '' ? null : Number(visRaw),
        participant_department_ids: selectedDepts,
        status: 'DRAFT'
      });
      if (res?.error) setError(res.error);
      else if (res?.data) router.push(`/meetings/${res.data.id}`);
    });
  }

  return (
    <form className="card p-5 space-y-4" action={submit}>
      <div>
        <label className="text-sm font-medium block mb-1">Tiêu đề *</label>
        <input name="title" required className="input" placeholder="VD: Họp giao ban khu vực tháng 8/2026" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Tóm tắt *</label>
        <textarea name="summary" required rows={3} className="input" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Phòng chủ trì *</label>
        {canPickAnyDepartment ? (
          <select name="host_department_id" required defaultValue={defaultDepartmentId} className="input">
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            {/* Nhân viên/Trưởng phòng chỉ được tạo họp do chính phòng mình chủ trì */}
            <input
              className="input bg-line/40 cursor-not-allowed"
              value={departments.find((d) => d.id === defaultDepartmentId)?.name ?? ''}
              disabled
              readOnly
            />
            <input type="hidden" name="host_department_id" value={defaultDepartmentId} />
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Thời gian bắt đầu *</label>
          <input name="start_at" type="datetime-local" required className="input" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Thời gian kết thúc *</label>
          <input name="end_at" type="datetime-local" required className="input" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Thời gian hiển thị sau kết thúc</label>
        <select name="visibility_duration_hours" defaultValue={48} className="input">
          {VISIBILITY_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-inksoft mt-1">
          Sau mốc thời gian này kể từ lúc kết thúc, cuộc họp tự ẩn khỏi Trang chủ và chuyển "Đã đóng"
          (vẫn tìm được ở Tìm kiếm) — không cần đóng/lưu trữ thủ công.
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Phòng được tham gia</label>
          <button type="button" onClick={toggleAll} className="text-xs text-gold underline">
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {departments.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedDepts.includes(d.id)}
                onChange={() => toggleDept(d.id)}
              />
              {d.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending && <span className="spinner" />}
          {isPending ? 'Đang tạo…' : 'Tạo cuộc họp (Nháp)'}
        </button>
      </div>
      <p className="text-xs text-inksoft">
        Cuộc họp sẽ được tạo ở dạng <span className="font-medium text-ink">Nháp</span> — chỉ mình bạn thấy
        được. Vào chi tiết cuộc họp sau khi tạo để bấm "Duyệt tạo cuộc họp" khi sẵn sàng cho các phòng ban
        được phân quyền xem.
      </p>
    </form>
  );
}
