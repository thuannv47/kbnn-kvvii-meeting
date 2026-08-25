'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from '@/actions/auth.actions';

function SubmitButton({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={compact ? 'text-xs text-inksoft underline disabled:opacity-50' : 'btn w-full text-xs'}
    >
      {pending && <span className="spinner mr-1.5" />}
      {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </button>
  );
}

export default function LogoutButton({ compact }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <SubmitButton compact={compact} />
    </form>
  );
}
