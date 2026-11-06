'use client';

import { useState } from 'react';
import type { Department } from '@/types/user';

export type PickableUser = {
  id: string;
  full_name: string;
  position: string | null;
  department_id: string | null;
  departments?: { name: string } | null;
};

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu (VD gõ "thang" vẫn ra "Thắng"). */
export function normalizeVN(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Bộ chọn người được xem / tham dự cuộc họp — dùng chung cho form TẠO và
 * chức năng SỬA cuộc họp.
 *  - mode "INTERNAL": có thêm khối "Phòng ban" để tick nhanh cả phòng.
 *  - mode "EXTERNAL": chỉ chọn từng người được cử đi.
 * Nguồn dữ liệu duy nhất là `selected` (mảng user id) do component cha giữ.
 */
export default function ParticipantPicker({
  departments,
  users,
  selected,
  onChange,
  mode,
  label,
  helper
}: {
  departments: Department[];
  users: PickableUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
  mode: 'INTERNAL' | 'EXTERNAL';
  label?: string;
  helper?: string;
}) {
  const [participantSearch, setParticipantSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  // Bấm vào TÊN 1 phòng (không phải ô vuông) sẽ lọc danh sách người bên dưới.
  const [peopleDeptFilter, setPeopleDeptFilter] = useState<string | null>(null);

  const selectedSet = new Set(selected);
  const selectedUserObjs = users.filter((u) => selectedSet.has(u.id));

  const filteredDepartments = deptSearch.trim()
    ? departments.filter((d) => normalizeVN(d.name).includes(normalizeVN(deptSearch.trim())))
    : departments;

  const peopleDeptFilterName = departments.find((d) => d.id === peopleDeptFilter)?.name ?? null;

  const filteredUsers = users.filter((u) => {
    const matchDept = mode === 'EXTERNAL' || !peopleDeptFilter || u.department_id === peopleDeptFilter;
    const q = normalizeVN(participantSearch.trim());
    const matchSearch =
      !q ||
      normalizeVN(u.full_name).includes(q) ||
      normalizeVN(u.position || '').includes(q) ||
      normalizeVN(u.departments?.name || '').includes(q);
    return matchDept && matchSearch;
  });

  function departmentUserIds(deptId: string) {
    return users.filter((u) => u.department_id === deptId).map((u) => u.id);
  }
  function isDeptFullySelected(deptId: string) {
    const ids = departmentUserIds(deptId);
    return ids.length > 0 && ids.every((id) => selectedSet.has(id));
  }
  function isDeptPartiallySelected(deptId: string) {
    const ids = departmentUserIds(deptId);
    return ids.some((id) => selectedSet.has(id)) && !isDeptFullySelected(deptId);
  }
  function toggleDept(deptId: string) {
    const ids = departmentUserIds(deptId);
    if (ids.length === 0) return;
    if (!isDeptFullySelected(deptId)) onChange(Array.from(new Set([...selected, ...ids])));
    else onChange(selected.filter((id) => !ids.includes(id)));
  }

  const allSelected = users.length > 0 && users.every((u) => selectedSet.has(u.id));
  function toggleAll() {
    onChange(allSelected ? [] : users.map((u) => u.id));
  }
  function toggleParticipant(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <>
      {mode === 'INTERNAL' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Phòng ban (chọn nhanh theo phòng)</label>
            <button type="button" onClick={toggleAll} className="text-xs text-gold underline">
              {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <p className="text-xs text-inksoft mb-2">
            Tick 1 phòng sẽ tự động tick <b>toàn bộ người trong phòng đó</b> ở danh sách bên dưới — bạn vẫn có
            thể bỏ tick riêng từng người để loại trừ họ. Bấm vào <b>tên phòng</b> (không phải ô vuông) để lọc
            nhanh người của phòng đó.
          </p>

          <input
            type="text"
            value={deptSearch}
            onChange={(e) => setDeptSearch(e.target.value)}
            placeholder="Tìm theo tên phòng ban…"
            className="input mb-2"
          />
          <div className="max-h-52 overflow-y-auto rounded border border-line bg-surface divide-y divide-line">
            {filteredDepartments.length === 0 && (
              <p className="text-xs text-inksoft px-3 py-2">Không tìm thấy phòng nào khớp "{deptSearch}".</p>
            )}
            {filteredDepartments.map((d) => {
              const count = departmentUserIds(d.id).length;
              return (
                <div key={d.id} className="flex items-center gap-2 text-sm px-3 py-2 hover:bg-paper2/60">
                  <input
                    type="checkbox"
                    disabled={count === 0}
                    checked={isDeptFullySelected(d.id)}
                    ref={(el) => {
                      if (el) el.indeterminate = isDeptPartiallySelected(d.id);
                    }}
                    onChange={() => toggleDept(d.id)}
                  />
                  <button
                    type="button"
                    onClick={() => setPeopleDeptFilter(peopleDeptFilter === d.id ? null : d.id)}
                    className={`flex-1 text-left ${peopleDeptFilter === d.id ? 'text-gold font-medium' : ''}`}
                    title="Bấm để lọc danh sách người bên dưới theo phòng này"
                  >
                    {d.name} <span className="text-inksoft text-xs">({count})</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium block mb-1">
          {label ?? (mode === 'INTERNAL' ? 'Người được xem cuộc họp' : 'Người tham gia dự họp')}{' '}
          <span className="text-red">* bắt buộc</span>
        </label>
        {helper && <p className="text-xs text-inksoft mb-2">{helper}</p>}

        {mode === 'INTERNAL' && peopleDeptFilterName && (
          <div className="flex items-center gap-1.5 mb-2 text-xs">
            <span className="text-inksoft">Đang lọc theo phòng:</span>
            <span className="inline-flex items-center gap-1 bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">
              {peopleDeptFilterName}
              <button type="button" onClick={() => setPeopleDeptFilter(null)} className="hover:text-red">
                ×
              </button>
            </span>
          </div>
        )}

        {selectedUserObjs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedUserObjs.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-ink text-white text-xs px-2.5 py-1"
              >
                {u.full_name}
                <button
                  type="button"
                  onClick={() => toggleParticipant(u.id)}
                  className="ml-0.5 opacity-70 hover:opacity-100"
                  aria-label={`Bỏ chọn ${u.full_name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {users.length === 0 ? (
          <p className="text-xs text-inksoft">Không có người dùng nào để chọn.</p>
        ) : (
          <>
            <input
              type="text"
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              placeholder="Tìm theo tên, chức danh hoặc phòng ban…"
              className="input mb-2"
            />
            <div className="max-h-52 overflow-y-auto rounded border border-line bg-surface divide-y divide-line">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-inksoft px-3 py-2">
                  {peopleDeptFilterName
                    ? `Phòng "${peopleDeptFilterName}" chưa có ai khớp tìm kiếm.`
                    : `Không tìm thấy ai khớp "${participantSearch}".`}
                </p>
              )}
              {filteredUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(u.id)}
                    onChange={() => toggleParticipant(u.id)}
                  />
                  <span>
                    {u.full_name}
                    <span className="text-inksoft">
                      {' '}
                      — {u.position || 'Chưa có chức danh'}
                      {u.departments?.name ? ` · ${u.departments.name}` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
