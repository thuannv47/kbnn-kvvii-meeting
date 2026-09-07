import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import PageHeader from '@/components/dashboard/page-header';
import MeetingCard from '@/components/meetings/meeting-card';
import { IconSort, IconSearch, IconFilter } from '@/components/ui/icons';

export default async function SearchPage({
  searchParams
}: {
  searchParams: { q?: string; department?: string; status?: string; sort?: 'asc' | 'desc' };
}) {
  await requireUser();
  const supabase = createServerSupabase();
  const q = searchParams.q?.trim() ?? '';
  const sort = searchParams.sort === 'asc' ? 'asc' : 'desc';

  const { data: departments } = await supabase.from('departments').select('*').order('name');

  let query = supabase
    .from('meetings')
    .select('*, departments:host_department_id(name)')
    // KHÔNG lọc theo visible_until ở đây -> lịch sử không bao giờ "biến mất"
    .order('start_at', { ascending: sort === 'asc' })
    .limit(50);

  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'simple' });
  if (searchParams.department) query = query.eq('host_department_id', searchParams.department);
  if (searchParams.status) query = query.eq('status', searchParams.status);

  const { data: results } = await query;
  const hasAdvancedFilter = !!(searchParams.department || searchParams.status);

  return (
    <div className="space-y-4">
      <PageHeader title="Tìm kiếm" />
      <h1 className="hidden md:block text-2xl">Tìm kiếm lịch sử</h1>

      <div className="flex gap-2">
        <a
          href={`/search?${new URLSearchParams({
            ...(q ? { q } : {}),
            ...(searchParams.department ? { department: searchParams.department } : {}),
            ...(searchParams.status ? { status: searchParams.status } : {}),
            sort: sort === 'asc' ? 'desc' : 'asc'
          }).toString()}`}
          aria-label="Đổi thứ tự sắp xếp"
          title={sort === 'asc' ? 'Đang xếp: cũ → mới' : 'Đang xếp: mới → cũ'}
          className="w-11 h-11 rounded-lg border border-line flex items-center justify-center flex-shrink-0 text-inksoft hover:border-gold/40"
        >
          <IconSort size={18} />
        </a>
        <form action="/search" method="get" className="flex-1 relative">
          <input type="hidden" name="sort" value={sort} />
          {searchParams.department && <input type="hidden" name="department" value={searchParams.department} />}
          {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inksoft" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Tìm kiếm theo tiêu đề" className="input h-11 !pl-9" />
        </form>
        <details className="relative">
          <summary
            className={`list-none w-11 h-11 rounded-lg border flex items-center justify-center flex-shrink-0 cursor-pointer ${
              hasAdvancedFilter ? 'border-gold text-gold' : 'border-line text-inksoft hover:border-gold/40'
            }`}
            aria-label="Bộ lọc nâng cao"
          >
            <IconFilter size={18} />
          </summary>
          <form
            action="/search"
            method="get"
            className="absolute right-0 mt-2 w-72 card p-4 space-y-3 z-20"
          >
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="sort" value={sort} />
            <div>
              <label className="text-xs text-inksoft mb-1 block">Phòng chủ trì</label>
              <select name="department" defaultValue={searchParams.department ?? ''} className="input">
                <option value="">Tất cả</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-inksoft mb-1 block">Trạng thái (hệ thống)</label>
              <select name="status" defaultValue={searchParams.status ?? ''} className="input">
                <option value="">Tất cả</option>
                <option value="DRAFT">Nháp</option>
                <option value="OPEN">Mở (OPEN)</option>
                <option value="CLOSED">Đã đóng</option>
                <option value="ARCHIVED">Lưu trữ</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full text-sm">
              Áp dụng
            </button>
          </form>
        </details>
      </div>

      <div className="space-y-3">
        {(!results || results.length === 0) && <p className="table-empty card">Không tìm thấy kết quả.</p>}
        {(results ?? []).map((m: any) => (
          <MeetingCard key={m.id} meeting={m} departmentName={m.departments?.name} />
        ))}
      </div>
    </div>
  );
}
