import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canCreateMeeting } from '@/lib/permissions';

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

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-inksoft border-b border-line">
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Tiêu đề</th>
              <th className="px-4 py-3 font-medium">Phòng chủ trì</th>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(meetings ?? []).map((m: any) => (
              <tr key={m.id} className="border-b border-line last:border-0 hover:bg-paper cursor-pointer">
                <td className="px-4 py-3">
                  <Link href={`/meetings/${m.id}`} className="font-mono text-xs text-gold">
                    {m.code}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/meetings/${m.id}`}>{m.title}</Link>
                </td>
                <td className="px-4 py-3">{m.departments?.name}</td>
                <td className="px-4 py-3">{new Date(m.start_at).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3">{m.status}</td>
              </tr>
            ))}
            {(!meetings || meetings.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-inksoft">
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
