import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canCreateMeeting } from '@/lib/permissions';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';

export default async function MeetingsListPage() {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)')
    .order('start_at', { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Cuộc họp</h1>
        {canCreateMeeting(profile) && (
          <Link href="/meetings/create" className="btn-primary">
            + Tạo cuộc họp
          </Link>
        )}
      </div>

      <div className="table-wrap">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tiêu đề</th>
              <th>Phòng chủ trì</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(meetings ?? []).map((m: any) => (
              <tr key={m.id} className="row-click">
                <td>
                  <Link href={`/meetings/${m.id}`} className="font-mono text-xs text-gold">
                    {m.code}
                  </Link>
                </td>
                <td>
                  <Link href={`/meetings/${m.id}`} className="font-medium">
                    {m.title}
                  </Link>
                </td>
                <td>{m.departments?.name}</td>
                <td className="whitespace-nowrap text-inksoft">
                  {new Date(m.start_at).toLocaleString('vi-VN')}
                </td>
                <td>
                  <MeetingStatusBadge meeting={m} />
                </td>
              </tr>
            ))}
            {(!meetings || meetings.length === 0) && (
              <tr>
                <td colSpan={5} className="table-empty">
                  Chưa có cuộc họp nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
