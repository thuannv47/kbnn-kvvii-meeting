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

  function submit(status: 'DRAFT' | 'OPEN', formData: FormData) {
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
        status
      });
      if (res?.error) setError(res.error);
      else if (res?.data) router.push(`/meetings/${res.data.id}`);
    });
  }

  return (
    <form
      className="card p-5 space-y-4"
      action={(fd) => submit((fd.get('_action') as any) || 'DRAFT', fd)}
    >
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
      </div>
      <div>
        <label className="text-sm font-medium block mb-2">Phòng được tham gia</label>
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
        <button
          type="submit"
          name="_action"
          value="DRAFT"
          disabled={isPending}
          className="btn"
        >
          Lưu nháp
        </button>
        <button
          type="submit"
          name="_action"
          value="OPEN"
          disabled={isPending}
          className="btn-primary"
        >
          Mở cuộc họp
        </button>
      </div>
    </form>
  );
}
