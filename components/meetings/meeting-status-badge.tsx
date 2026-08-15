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
      <span aria-hidden>{st.icon}</span>
      {st.label}
    </span>
  );
}
