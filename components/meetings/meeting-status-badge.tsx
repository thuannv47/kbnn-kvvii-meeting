import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import type { Meeting } from '@/types/meeting';

export default function MeetingStatusBadge({
  meeting,
  now
}: {
  meeting: Pick<Meeting, 'status' | 'start_at' | 'end_at'>;
  now?: Date;
}) {
  const st = getMeetingDisplayStatus(meeting, now);
  return (
    <span className={st.className}>
      {st.key === 'LIVE' ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
      ) : (
        <span aria-hidden>{st.icon}</span>
      )}
      {st.label}
    </span>
  );
}
