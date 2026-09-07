import { getMeetingDisplayStatus } from '@/lib/meetings/status';
import type { Meeting } from '@/types/meeting';
import { IconFile } from '@/components/ui/icons';

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
      {st.dotColor ? (
        <span className="dot" style={{ background: st.dotColor }} aria-hidden />
      ) : (
        <IconFile size={10} aria-hidden />
      )}
      {st.label}
    </span>
  );
}
