'use client';

import { logoutAction } from '@/actions/auth.actions';

export default function LogoutButton({ compact }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={compact ? 'text-xs text-inksoft underline' : 'btn w-full text-xs'}>
        Đăng xuất
      </button>
    </form>
  );
}
