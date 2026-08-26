'use client';

import { useRef, useState, useTransition } from 'react';
import { createDepartmentAction } from '@/actions/department.actions';

export default function DepartmentForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={ref}
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await createDepartmentAction(fd);
          if (res?.error) setError(res.error);
          else ref.current?.reset();
        });
      }}
      className="card p-4 flex flex-wrap gap-2 items-end"
    >
      <div>
        <label className="text-xs font-medium block mb-1">Mã</label>
        <input name="code" required className="input w-32" placeholder="PGD03" />
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="text-xs font-medium block mb-1">Tên phòng ban</label>
        <input name="name" required className="input" placeholder="Phòng giao dịch 03" />
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Loại</label>
        <select name="department_type" className="input">
          <option value="HEAD_OFFICE">Hội sở</option>
          <option value="BRANCH">Chi nhánh/PGD</option>
        </select>
      </div>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending && <span className="spinner" />}
        {isPending ? 'Đang thêm…' : '+ Thêm'}
      </button>
      {error && <p className="text-red text-sm w-full">{error}</p>}
    </form>
  );
}
