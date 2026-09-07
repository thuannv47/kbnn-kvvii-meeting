'use client';

import { useMemo, useState } from 'react';

type Department = {
  id: string;
  code: string;
  name: string;
  department_type: string;
  active: boolean;
};

const typeLabel: Record<string, string> = {
  HEAD_OFFICE: 'Hội sở',
  BRANCH: 'Chi nhánh / PGD'
};

export default function DepartmentFilter({ departments }: { departments: Department[] }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<'ALL' | 'HEAD_OFFICE' | 'BRANCH'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return departments.filter((d) => {
      if (kw && !d.name.toLowerCase().includes(kw) && !d.code.toLowerCase().includes(kw)) return false;
      if (type !== 'ALL' && d.department_type !== type) return false;
      if (status === 'ACTIVE' && !d.active) return false;
      if (status === 'INACTIVE' && d.active) return false;
      return true;
    });
  }, [departments, q, type, status]);

  const hasFilter = q.trim() !== '' || type !== 'ALL' || status !== 'ALL';

  return (
    <div className="space-y-3">
      {/* Bộ lọc tìm kiếm nhanh: gõ tới đâu lọc tới đó, không cần bấm nút tìm kiếm */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-inksoft text-sm pointer-events-none">
            🔎
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc mã phòng ban…"
            className="input pl-9"
          />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="input w-auto min-w-[150px]">
          <option value="ALL">Tất cả loại</option>
          <option value="HEAD_OFFICE">Hội sở</option>
          <option value="BRANCH">Chi nhánh/PGD</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input w-auto min-w-[140px]">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng</option>
        </select>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setType('ALL');
              setStatus('ALL');
            }}
            className="text-xs text-inksoft underline"
          >
            Xoá lọc
          </button>
        )}
      </div>

      {hasFilter && (
        <p className="text-xs text-inksoft">
          Tìm thấy <span className="font-semibold text-ink">{filtered.length}</span> / {departments.length} phòng ban
        </p>
      )}

      <div className="table-wrap">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Loại</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-xs text-inksoft">{d.code}</td>
                <td className="font-medium">{d.name}</td>
                <td>{typeLabel[d.department_type] ?? d.department_type}</td>
                <td>
                  {d.active ? (
                    <span className="tag">Hoạt động</span>
                  ) : (
                    <span className="tag-muted">Ngừng</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">
                  {departments.length === 0
                    ? 'Chưa có phòng ban nào.'
                    : 'Không tìm thấy phòng ban phù hợp với bộ lọc.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
