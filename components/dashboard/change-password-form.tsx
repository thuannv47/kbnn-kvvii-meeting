'use client';

import { useRef, useState, useTransition } from 'react';
import { changePasswordAction } from '@/actions/auth.actions';

export default function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await changePasswordAction(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="card p-5 max-w-md space-y-3">
      <h3 className="font-semibold">Đổi mật khẩu</h3>
      <form ref={formRef} action={submit} className="space-y-2.5">
        <div>
          <label className="text-xs font-medium block mb-1">Mật khẩu hiện tại *</label>
          <input name="currentPassword" type="password" required autoComplete="current-password" className="input" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Mật khẩu mới *</label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            placeholder="Tối thiểu 8 ký tự"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Xác nhận mật khẩu mới *</label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </div>

        {error && <p className="text-red text-sm">{error}</p>}
        {success && <p className="text-green text-sm">Đổi mật khẩu thành công.</p>}

        <div className="pt-2">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}
