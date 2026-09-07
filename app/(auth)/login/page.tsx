'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/actions/auth.actions';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Đặt file Logokbnn.png vào thư mục public/ của project để logo hiển thị ở đây */}
        <img src="/Logokbnn.png" alt="Logo KBNN" className="w-20 h-20 mx-auto mb-5 rounded-full object-cover" />

        <div className="card p-8">
          <span className="eyebrow inline-block font-mono text-[11px] tracking-widest uppercase text-gold bg-gold/10 border border-gold/30 px-2.5 py-1 rounded-full">
            Hệ thống nội bộ
          </span>
          <h1 className="text-2xl mt-4 mb-1">Phòng họp không giấy tờ</h1>
          <p className="text-inksoft text-sm mb-6">Đăng nhập bằng tài khoản được cấp.</p>

          <form
            className="space-y-3"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const res = await loginAction(formData);
                if (res?.error) {
                  setError(res.error);
                } else {
                  // Điều hướng phía client (không phải server redirect) để giữ
                  // đúng chế độ standalone khi app được mở từ icon "Thêm vào
                  // Màn hình chính" trên iPhone — tránh bị bung thanh địa chỉ.
                  router.push('/dashboard');
                }
              });
            }}
          >
            <div>
              <label className="text-sm font-medium block mb-1">Tên đăng nhập</label>
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                className="input"
                placeholder="vd: binhtt"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Mật khẩu</label>
              <input name="password" type="password" required className="input" placeholder="••••••••" />
            </div>
            {error && <p className="text-red text-sm">{error}</p>}
            <button type="submit" disabled={isPending} className="btn-primary w-full mt-2">
              {isPending && <span className="spinner" />}
              {isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
