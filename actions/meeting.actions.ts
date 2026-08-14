'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';
import { canCreateMeeting, canHostDepartment, canManageMeeting, canDeleteMeeting } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';

const createMeetingSchema = z.object({
  title: z.string().min(3, 'Tiêu đề tối thiểu 3 ký tự'),
  summary: z.string().optional(),
  host_department_id: z.string().uuid(),
  start_at: z.string(),
  end_at: z.string(),
  visibility_duration_hours: z.coerce.number().nullable(),
  participant_department_ids: z.array(z.string().uuid()).default([]),
  status: z.enum(['DRAFT', 'OPEN']).default('DRAFT')
});

function genMeetingCode() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `HNK-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

export async function createMeetingAction(input: z.infer<typeof createMeetingSchema>) {
  const { authId, profile } = await requireUser();

  // Lớp phòng thủ 2: chặn ở server trước khi động DB.
  // Kiểm tra active NGHIÊM NGẶT (=== true), khớp đúng với điều kiện RLS
  // "and p.active" ở policy meetings_insert (không chấp nhận null/undefined).
  if (profile.active !== true) {
    return {
      error:
        'Tài khoản của bạn đang bị vô hiệu hoá (active = false/NULL trong bảng profiles). Liên hệ Quản trị viên để kích hoạt lại.'
    };
  }
  if (!canCreateMeeting(profile)) {
    return { error: 'Bạn không có quyền tạo cuộc họp.' };
  }

  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' };
  }
  const data = parsed.data;

  // Lớp phòng thủ 2b: chỉ được chọn "phòng chủ trì" đúng phòng của mình (trừ BGD/ADMIN).
  if (!canHostDepartment(profile, data.host_department_id)) {
    return { error: 'Bạn chỉ có thể tạo cuộc họp do phòng ban của mình chủ trì.' };
  }

  if (new Date(data.end_at) <= new Date(data.start_at)) {
    return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };
  }

  const supabase = createServerSupabase();

  // ---- DEBUG TẠM THỜI: kiểm tra session thực tế ngay trước khi insert ----
  const { data: sessionCheck, error: sessionErr } = await supabase.auth.getUser();
  if (!sessionCheck?.user) {
    return {
      error:
        'DEBUG: Server Action KHÔNG nhận được session hợp lệ (auth.uid() sẽ là NULL). ' +
        'sessionErr=' + (sessionErr?.message ?? 'không có user') +
        '. Đây là nguyên nhân RLS chặn insert, không liên quan tới active/department.'
    };
  }
  if (sessionCheck.user.id !== authId) {
    return {
      error: `DEBUG: session mismatch — requireUser()=${authId} nhưng auth.getUser() ngay trước insert=${sessionCheck.user.id}.`
    };
  }
  // ---- HẾT DEBUG ----

  // ---- DEBUG TẠM THỜI: hỏi thẳng Postgres auth.uid() nó thấy là gì (khác với
  // supabase.auth.getUser() vốn chỉ giải mã JWT tại chỗ, không phản ánh đúng
  // những gì PostgREST/Postgres thực sự dùng để chạy RLS) ----
  const { data: whoami, error: whoamiErr } = await supabase.rpc('debug_whoami' as any);
  const { data: checkDetail, error: checkErr } = await supabase.rpc(
    'debug_meeting_insert_check' as any,
    { p_host_dept: data.host_department_id }
  );
  // ---- HẾT DEBUG ----

  // Lớp phòng thủ 3: RLS sẽ tự chặn nếu policy meetings_insert không cho phép.
  //
  // QUAN TRỌNG: KHÔNG dùng .select().single() ngay sau insert() — Postgres coi
  // "INSERT ... RETURNING" là một lượt ĐỌC LẠI dòng vừa tạo, nên ngoài policy
  // INSERT (with_check) nó còn áp thêm policy SELECT lên chính dòng đó. Tách làm
  // 2 bước: insert trước (không RETURNING), rồi SELECT lại sau bằng "code".
  const meetingCode = genMeetingCode();
  const { error } = await supabase.from('meetings').insert({
    code: meetingCode,
    title: data.title,
    summary: data.summary ?? null,
    host_department_id: data.host_department_id,
    start_at: data.start_at,
    end_at: data.end_at,
    visibility_duration_hours: data.visibility_duration_hours,
    status: data.status,
    created_by: authId
  });

  if (error) {
    const hint = error.message?.includes('row-level security')
      ? ` (DEBUG detail=${JSON.stringify(checkDetail)}, checkErr=${checkErr?.message ?? 'none'})`
      : '';
    return { error: 'Không tạo được cuộc họp: ' + error.message + hint };
  }

  const { data: meeting, error: fetchErr } = await supabase
    .from('meetings')
    .select('*')
    .eq('code', meetingCode)
    .single();

  if (fetchErr || !meeting) {
    return {
      error:
        'Đã tạo cuộc họp thành công nhưng không đọc lại được ngay để chuyển trang. ' +
        'Vui lòng vào lại trang "Cuộc họp" để xem. Lỗi đọc: ' + (fetchErr?.message ?? '')
    };
  }

  if (data.participant_department_ids.length > 0) {
    const rows = data.participant_department_ids.map((dept_id) => ({
      meeting_id: meeting.id,
      department_id: dept_id,
      can_view: true,
      can_comment: true
    }));
    await supabase.from('meeting_departments').insert(rows);
  }

  await logAudit({
    userId: authId,
    action: 'CREATE_MEETING',
    entityType: 'meeting',
    entityId: meeting.id,
    metadata: { code: meeting.code, title: meeting.title }
  });

  revalidatePath('/dashboard');
  revalidatePath('/meetings');
  return { data: meeting };
}

export async function updateMeetingStatusAction(meetingId: string, status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED') {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canManageMeeting(meeting as any, profile)) {
    return { error: 'Bạn không có quyền quản lý cuộc họp này.' };
  }

  const { error } = await supabase.from('meetings').update({ status }).eq('id', meetingId);
  if (error) return { error: error.message };

  await logAudit({ userId: authId, action: `SET_MEETING_${status}`, entityType: 'meeting', entityId: meetingId });
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

/**
 * Xoá hẳn một cuộc họp khỏi hệ thống (khác với "huỷ" — dùng updateMeetingStatusAction
 * để đổi status sang ARCHIVED nếu chỉ muốn dừng hiệu lực mà vẫn giữ dữ liệu/lịch sử).
 *
 * Quyền hạn (khớp với RLS policy "meetings_delete", xem 0004_admin_only_draft_delete.sql):
 * - CHỈ Quản trị viên (ADMIN) mới được xoá.
 * - CHỈ khi cuộc họp còn ở trạng thái Nháp (DRAFT). Cuộc họp đang diễn ra (OPEN) hoặc
 *   đã đóng/lưu trữ (CLOSED/ARCHIVED) thì KHÔNG được xoá dưới bất kỳ hình thức nào,
 *   kể cả bởi ADMIN — dùng updateMeetingStatusAction để "huỷ" (chuyển ARCHIVED) thay vì xoá.
 *
 * Việc xoá sẽ cascade xoá luôn tài liệu, ý kiến, kết luận, phân quyền phòng ban
 * gắn với cuộc họp này (xem "on delete cascade" trong migration 0001_init.sql).
 */
export async function deleteMeetingAction(meetingId: string) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canDeleteMeeting(meeting as any, profile)) {
    return {
      error:
        'Bạn không có quyền xoá cuộc họp này. Chỉ Quản trị viên (ADMIN) mới được xoá, và chỉ khi cuộc ' +
        'họp còn ở trạng thái Nháp (DRAFT). Cuộc họp đang diễn ra hoặc đã đóng/lưu trữ không thể xoá — ' +
        'hãy dùng chức năng "Huỷ cuộc họp" nếu chỉ muốn dừng hiệu lực.'
    };
  }

  const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
  if (error) return { error: 'Không xoá được cuộc họp: ' + error.message };

  await logAudit({
    userId: authId,
    action: 'DELETE_MEETING',
    entityType: 'meeting',
    entityId: meetingId,
    metadata: { code: meeting.code, title: meeting.title, status_at_deletion: meeting.status }
  });

  revalidatePath('/dashboard');
  revalidatePath('/meetings');
  return { success: true };
}

export async function updateMeetingDepartmentsAction(
  meetingId: string,
  perms: { department_id: string; can_view: boolean; can_comment: boolean }[]
) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  if (!meeting || !canManageMeeting(meeting as any, profile)) {
    return { error: 'Bạn không có quyền phân quyền phòng ban cho cuộc họp này.' };
  }

  await supabase.from('meeting_departments').delete().eq('meeting_id', meetingId);
  if (perms.length > 0) {
    await supabase
      .from('meeting_departments')
      .insert(perms.map((p) => ({ meeting_id: meetingId, ...p })));
  }

  await logAudit({ userId: authId, action: 'UPDATE_MEETING_PERMISSIONS', entityType: 'meeting', entityId: meetingId });
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}
