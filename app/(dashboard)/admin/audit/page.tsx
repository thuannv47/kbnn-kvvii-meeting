import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageOrg } from '@/lib/permissions';

const actionLabel: Record<string, string> = {
  CREATE_MEETING: 'Tạo cuộc họp',
  SET_MEETING_OPEN: 'Mở cuộc họp',
  SET_MEETING_CLOSED: 'Đóng cuộc họp',
  SET_MEETING_ARCHIVED: 'Lưu trữ cuộc họp',
  UPDATE_MEETING_PERMISSIONS: 'Cập nhật phân quyền cuộc họp',
  UPLOAD_DOCUMENT: 'Tải tài liệu lên',
  ADD_DOCUMENT_VERSION: 'Thêm phiên bản tài liệu',
  VIEW_DOCUMENT: 'Xem tài liệu',
  ADD_COMMENT: 'Gửi ý kiến',
  DRAFT_CONCLUSION: 'Soạn kết luận',
  CONFIRM_CONCLUSION: 'Xác nhận kết luận',
  CREATE_DEPARTMENT: 'Tạo phòng ban',
  CREATE_USER: 'Tạo người dùng',
  ACTIVATE_USER: 'Kích hoạt người dùng',
  DEACTIVATE_USER: 'Vô hiệu hoá người dùng'
};

export default async function AuditLogPage({
  searchParams
}: {
  searchParams: { action?: string; entity_type?: string };
}) {
  const { profile } = await requireUser();
  if (!canManageOrg(profile)) redirect('/dashboard');

  const supabase = createServerSupabase();
  let query = supabase
    .from('audit_logs')
    .select('*, profiles:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (searchParams.action) query = query.eq('action', searchParams.action);
  if (searchParams.entity_type) query = query.eq('entity_type', searchParams.entity_type);

  const { data: logs } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Audit Log</h1>

      <form className="card p-4 grid gap-3 sm:grid-cols-3">
        <select name="action" defaultValue={searchParams.action ?? ''} className="input">
          <option value="">Tất cả hành động</option>
          {Object.entries(actionLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="entity_type" defaultValue={searchParams.entity_type ?? ''} className="input">
          <option value="">Tất cả đối tượng</option>
          <option value="meeting">Cuộc họp</option>
          <option value="document">Tài liệu</option>
          <option value="comment">Ý kiến</option>
          <option value="conclusion">Kết luận</option>
          <option value="profile">Người dùng</option>
          <option value="department">Phòng ban</option>
        </select>
        <button type="submit" className="btn-primary">
          Lọc
        </button>
      </form>

      <div className="table-wrap">
        <table className="table-clean">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log: any) => (
              <tr key={log.id}>
                <td className="font-medium">{log.profiles?.full_name ?? '—'}</td>
                <td>{actionLabel[log.action] ?? log.action}</td>
                <td className="font-mono text-xs text-inksoft">
                  {log.entity_type}
                  {log.entity_id ? ` · ${String(log.entity_id).slice(0, 8)}` : ''}
                </td>
                <td className="whitespace-nowrap text-inksoft">
                  {new Date(log.created_at).toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={4} className="table-empty">
                  Chưa có bản ghi nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
