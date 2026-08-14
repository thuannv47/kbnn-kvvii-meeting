'use client';

import { useState, useTransition } from 'react';
import type { Meeting, MeetingConclusion } from '@/types/meeting';
import type { Profile } from '@/types/user';
import { canDraftConclusion, canConfirmConclusion } from '@/lib/permissions';
import { draftConclusionAction, confirmConclusionAction } from '@/actions/conclusion.actions';

export default function TabConclusion({
  meeting,
  conclusion,
  profile,
  canManage
}: {
  meeting: Meeting;
  conclusion: MeetingConclusion | null;
  profile: Profile;
  canManage: boolean;
}) {
  const [content, setContent] = useState(conclusion?.content ?? '');
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const canDraft = canDraftConclusion(meeting, profile);
  const canConfirm = canConfirmConclusion(conclusion, profile);
  const isConfirmed = conclusion?.status === 'CONFIRMED';

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await draftConclusionAction(meeting.id, content);
      setMsg(res?.error ?? 'Đã lưu bản nháp kết luận.');
    });
  }

  function confirm() {
    setMsg(null);
    startTransition(async () => {
      const res = await confirmConclusionAction(meeting.id);
      setMsg(res?.error ?? 'Đã xác nhận kết luận.');
    });
  }

  if (!conclusion && !canDraft) {
    return <p className="text-sm text-inksoft">Chưa có kết luận cho cuộc họp này.</p>;
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Kết luận cuộc họp</h3>
        <span className={`badge ${isConfirmed ? 'bg-green text-white' : 'bg-line text-inksoft'}`}>
          {isConfirmed ? 'Đã xác nhận' : 'Bản nháp'}
        </span>
      </div>

      {canDraft && !isConfirmed ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="input"
          placeholder="Nhập nội dung kết luận cuộc họp…"
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap">{conclusion?.content || '—'}</p>
      )}

      {msg && <p className="text-sm text-inksoft">{msg}</p>}

      <div className="flex gap-2">
        {canDraft && !isConfirmed && (
          <button onClick={save} disabled={isPending} className="btn">
            Lưu bản nháp
          </button>
        )}
        {canConfirm && (
          <button onClick={confirm} disabled={isPending} className="btn-primary">
            Xác nhận kết luận (BGĐ)
          </button>
        )}
      </div>
    </div>
  );
}
