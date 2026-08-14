'use client';

import { useState, useTransition } from 'react';
import { updateUserAction } from '@/actions/user.actions';
import type { Department, Profile } from '@/types/user';

export default function UserEditDialog({
  user,
  departments,
  onClose
}: {
  user: Profile;
  departments: Department[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateUserAction(user.id, formData);
      if (res?.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card w-full max-w-md p-5 space-y-3">
        <h3 className="font-semibold">Sửa người dùng</h3>
        <form action={submit} className="space-y-2.5">
          <div>
            <label className="text-xs font-medium block mb-1">Họ tên *</label>
            <input name="full_name" defaultValue={user.full_name} required className="input" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Tên đăng nhập *</label>
            <input
              name="username"
              defaultValue={user.username}
              required
              pattern="^[a-z0-9][a-z0-9._-]{2,29}$"
              title="Chữ thường, số, dấu . _ -, 3-30 ký tự, bắt đầu bằng chữ hoặc số"
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Chức danh</label>
            <input name="position" defaultValue={user.position ?? ''} className="input" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Phòng ban *</label>
            <select name="department_id" required defaultValue={user.department_id ?? ''} className="input">
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
            <select name="role" required defaultValue={user.role} className="input">
              <option value="MEMBER">Chuyên viên (MEMBER)</option>
              <option value="MANAGER">Trưởng/Phó phòng (MANAGER)</option>
              <option value="BGD">Ban Giám đốc (BGD)</option>
              <option value="ADMIN">Quản trị hệ thống (ADMIN)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Mật khẩu mới (bỏ trống nếu không đổi)</label>
            <input name="password" type="password" minLength={8} className="input" placeholder="Tối thiểu 8 ký tự" />
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
