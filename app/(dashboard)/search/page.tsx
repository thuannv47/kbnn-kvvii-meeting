import Link from 'next/link';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';

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
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="OPEN">Đang diễn ra</option>
          <option value="CLOSED">Đã kết thúc</option>
          <option value="ARCHIVED">Lưu trữ</option>
        </select>
        <button type="submit" className="btn-primary sm:col-span-4">
          Tìm kiếm
        </button>
      </form>

      <div className="space-y-2">
        {(results ?? []).map((m: any) => (
          <Link key={m.id} href={`/meetings/${m.id}`} className="card p-3.5 flex items-center justify-between hover:border-gold block">
            <div>
              <p className="font-mono text-xs text-inksoft">{m.code}</p>
              <p className="font-medium">{m.title}</p>
              <p className="text-xs text-inksoft">{m.departments?.name}</p>
            </div>
            <span className="text-xs text-inksoft">{new Date(m.start_at).toLocaleDateString('vi-VN')}</span>
          </Link>
        ))}
        {results && results.length === 0 && <p className="text-sm text-inksoft">Không tìm thấy kết quả.</p>}
      </div>
    </div>
  );
}
