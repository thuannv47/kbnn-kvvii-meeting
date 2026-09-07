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

// Bỏ dấu tiếng Việt để so khớp tìm kiếm không phân biệt dấu (vd: "phong ke toan" vẫn tìm ra "Phòng Kế toán")
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export default function DepartmentsTable({ departments }: { departments: Department[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return departments;
    return departments.filter(
      (d) => normalize(d.name).includes(q) || normalize(d.code).includes(q)
    );
  }, [departments, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-inksoft">
          🔎
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hoặc mã phòng ban…"
          className="input pl-9"
        />
      </div>

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
                    : `Không tìm thấy phòng ban nào khớp với "${query}".`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
