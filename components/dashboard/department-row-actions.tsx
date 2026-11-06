'use client';

import { useState, useTransition } from 'react';
import {
  updateDepartmentAction,
  toggleDepartmentActiveAction,
  deleteDepartmentAction
} from '@/actions/department.actions';

type Department = {
  id: string;
  code: string;
  name: string;
  department_type: string;
  active: boolean;
};

function EditDialog({ dept, onClose }: { dept: Department; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateDepartmentAction(dept.id, {
        code: String(fd.get('code') || ''),
        name: String(fd.get('name') || ''),
        department_type: String(fd.get('department_type') || 'HEAD_OFFICE')
      });
      if (res?.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card w-full max-w-md p-5 space-y-3 text-left">
        <h3 className="font-semibold">Sửa phòng ban</h3>
        <form action={submit} className="space-y-2.5">
          <div>
            <label className="text-xs font-medium block mb-1">Mã *</label>
            <input name="code" defaultValue={dept.code} required className="input" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Tên phòng ban *</label>
            <input name="name" defaultValue={dept.name} required className="input" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Loại</label>
            <select name="department_type" defaultValue={dept.department_type} className="input">
              <option value="HEAD_OFFICE">Hội sở</option>
              <option value="BRANCH">Chi nhánh/PGD</option>
            </select>
          </div>
          {error && <p className="text-red text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn" disabled={isPending}>
              Huỷ
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DepartmentRowActions({ dept }: { dept: Department }) {
  const [isPending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      setConfirmDelete(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <button onClick={() => setShowEdit(true)} className="text-xs underline text-inksoft">
        Sửa
      </button>

      <button
        onClick={() => run(() => toggleDepartmentActiveAction(dept.id, !dept.active))}
        disabled={isPending}
        className={`text-xs underline ${dept.active ? 'text-red' : 'text-green'} disabled:opacity-40`}
      >
        {dept.active ? 'Ngừng' : 'Kích hoạt lại'}
      </button>

      {confirmDelete ? (
        <span className="flex items-center gap-1.5">
          <span className="text-xs text-inksoft">Chắc chắn?</span>
          <button
            onClick={() => run(() => deleteDepartmentAction(dept.id))}
            disabled={isPending}
            className="text-xs underline text-red"
          >
            Xoá
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs underline text-inksoft">
            Huỷ
          </button>
        </span>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="text-xs underline text-red">
          Xoá
        </button>
      )}

      {error && <span className="w-full text-xs text-red text-right">{error}</span>}
      {showEdit && <EditDialog dept={dept} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
