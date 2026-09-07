'use client';

import { useState, useTransition } from 'react';
import { toggleUserActiveAction, deleteUserAction } from '@/actions/user.actions';
import type { Department, Profile } from '@/types/user';
import UserEditDialog from './user-edit-dialog';

export default function UserRowActions({
  user,
  departments,
  currentUserId
}: {
  user: Profile;
  departments: Department[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteUserAction(user.id);
      if (res?.error) {
        setDeleteError(res.error);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <button onClick={() => setShowEdit(true)} className="text-xs underline text-inksoft">
        Sửa
      </button>

      <button
        onClick={() =>
          startTransition(() => {
            toggleUserActiveAction(user.id, !user.active);
          })
        }
        disabled={isPending || isSelf}
        title={isSelf ? 'Không thể tự vô hiệu hoá chính mình' : undefined}
        className={`text-xs underline ${user.active ? 'text-red' : 'text-green'} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {user.active ? 'Vô hiệu hoá' : 'Kích hoạt lại'}
      </button>

      {confirmDelete ? (
        <span className="flex items-center gap-1.5">
          <span className="text-xs text-inksoft">Chắc chắn?</span>
          <button onClick={handleDelete} disabled={isPending} className="text-xs underline text-red">
            Xoá
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs underline text-inksoft">
            Huỷ
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={isSelf}
          title={isSelf ? 'Không thể tự xoá chính mình' : undefined}
          className="text-xs underline text-red disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Xoá
        </button>
      )}

      {deleteError && <span className="w-full text-xs text-red text-right">{deleteError}</span>}

      {showEdit && (
        <UserEditDialog user={user} departments={departments} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
