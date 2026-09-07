'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '@/actions/auth.actions';

function SubmitButton({ compact, pending }: { compact?: boolean; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={compact ? 'text-xs text-white/80 underline disabled:opacity-50 flex-shrink-0' : 'btn w-full text-xs'}
    >
      {pending && <span className="spinner mr-1.5" />}
      {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </button>
  );
}

export default function LogoutButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          await logoutAction();
          // Điều hướng phía client, không phải server redirect — giữ đúng chế
          // độ standalone khi mở app từ icon "Thêm vào Màn hình chính" iPhone.
          router.push('/login');
        });
      }}
    >
      <SubmitButton compact={compact} pending={isPending} />
    </form>
  );
}
