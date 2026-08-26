'use client';

import { useRef, useState, useTransition } from 'react';
import { createUserAction } from '@/actions/user.actions';
import type { Department } from '@/types/user';

export default function UserForm({ departments }: { departments: Department[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={ref}
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await createUserAction(fd);
          if (res?.error) setError(res.error);
          else ref.current?.reset();
        });
      }}
      className="card p-4 space-y-3"
    >
      <h3 className="font-semibold">Thêm người dùng</h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium block mb-1">Họ tên *</label>
          <input name="full_name" required className="input" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Chức danh</label>
          <input name="position" className="input" placeholder="VD: Trưởng phòng TCHC" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Tên đăng nhập *</label>
          <input
            name="username"
            required
            pattern="^[a-z0-9][a-z0-9._-]{2,29}$"
            title="Chữ thường, số, dấu . _ -, 3-30 ký tự, bắt đầu bằng chữ hoặc số"
            className="input"
            placeholder="vd: binhtt"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Mật khẩu tạm thời *</label>
          <input name="password" type="password" required minLength={8} className="input" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Phòng ban *</label>
          <select name="department_id" required className="input">
            <option value="">— Chọn phòng ban —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Vai trò *</label>
          <select name="role" required defaultValue="MEMBER" className="input">
            <option value="MEMBER">Chuyên viên (MEMBER)</option>
            <option value="MANAGER">Trưởng/Phó phòng (MANAGER)</option>
            <option value="THUKY">Thư ký (THUKY)</option>
            <option value="BGD">Ban Giám đốc (BGD)</option>
            <option value="ADMIN">Quản trị hệ thống (ADMIN)</option>
          </select>
          <p className="text-xs text-inksoft mt-1">
            Chọn "Thư ký" và gán Phòng ban ở trên là "Ban Giám đốc" nếu muốn người này thay mặt BGD
            tạo/sắp đặt/Duyệt cuộc họp — không có quyền giám sát toàn ngành như BGD thật sự.
          </p>
        </div>
      </div>
      {error && <p className="text-red text-sm">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending && <span className="spinner" />}
        {isPending ? 'Đang tạo…' : '+ Tạo người dùng'}
      </button>
    </form>
  );
}
