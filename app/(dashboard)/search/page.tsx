import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';

export default async function SearchPage({
  searchParams
}: {
  searchParams: { q?: string; department?: string; status?: string };
}) {
  await requireUser();
  const supabase = createServerSupabase();
  const q = searchParams.q?.trim() ?? '';

  const { data: departments } = await supabase.from('departments').select('*').order('name');

  let query = supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)')
    // KHÔNG lọc theo visible_until ở đây -> lịch sử không bao giờ "biến mất"
    .order('start_at', { ascending: false })
    .limit(50);

  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'simple' });
  if (searchParams.department) query = query.eq('host_department_id', searchParams.department);
  if (searchParams.status) query = query.eq('status', searchParams.status);

  const { data: results } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Tìm kiếm lịch sử</h1>

      <form className="card p-4 grid gap-3 sm:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="Từ khoá, mã cuộc họp…" className="input sm:col-span-2" />
        <select name="department" defaultValue={searchParams.department ?? ''} className="input">
          <option value="">Tất cả phòng chủ trì</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ''} className="input">
          <option value="">Tất cả trạng thái (DB)</option>
          <option value="DRAFT">Nháp</option>
          <option value="OPEN">Mở (OPEN)</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="ARCHIVED">Lưu trữ</option>
        </select>
        <button type="submit" className="btn-primary sm:col-span-4">
          Tìm kiếm
        </button>
      </form>

      <div className="table-wrap">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tiêu đề</th>
              <th>Phòng chủ trì</th>
              <th>Ngày họp</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(results ?? []).map((m: any) => (
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
                  {new Date(m.start_at).toLocaleDateString('vi-VN')}
                </td>
                <td>
                  <MeetingStatusBadge meeting={m} />
                </td>
              </tr>
            ))}
            {(!results || results.length === 0) && (
              <tr>
                <td colSpan={5} className="table-empty">
                  Không tìm thấy kết quả.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
