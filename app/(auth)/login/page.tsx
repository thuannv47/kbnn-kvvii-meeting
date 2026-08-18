'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { loginAction } from '@/actions/auth.actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* nền trang trí — quầng sáng vàng đồng nhẹ phía trên card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_480px_at_50%_-10%,rgba(156,107,20,0.10),transparent_60%)]"
      />
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold/5 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-ink/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="card p-8 pt-9 shadow-card">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-[68px] w-[68px] items-center justify-center rounded-full border border-gold/25 bg-white shadow-card">
              <Image
                src="/logo-kbnn.png"
                alt="Kho bạc Nhà nước"
                width={42}
                height={42}
                className="h-[42px] w-[42px] object-contain"
                priority
              />
            </div>
            <span className="mb-3 inline-block rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-widest text-gold">
              Hệ thống nội bộ
            </span>
            <h1 className="font-display text-2xl font-semibold text-ink">Phòng họp không giấy tờ</h1>
            <p className="mt-1 text-sm text-inksoft">Kho bạc Nhà nước Khu vực VII</p>
          </div>

          <form
            className="space-y-3.5"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const res = await loginAction(formData);
                if (res?.error) setError(res.error);
              });
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Tên đăng nhập</label>
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
              <label className="mb-1 block text-sm font-medium text-ink">Mật khẩu</label>
              <input name="password" type="password" required className="input" placeholder="••••••••" />
            </div>
            {error && (
              <p className="rounded-lg border border-red/20 bg-red-soft px-3 py-2 text-[13px] text-red">{error}</p>
            )}
            <button type="submit" disabled={isPending} className="btn-primary mt-2 w-full">
              {isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-inksoft">
          © {new Date().getFullYear()} Kho bạc Nhà nước Khu vực VII — Chỉ dành cho cán bộ được cấp tài khoản.
        </p>
      </div>
    </div>
  );
}
