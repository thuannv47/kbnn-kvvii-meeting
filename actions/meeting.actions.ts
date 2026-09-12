'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/current-user';
import { canCreateMeeting, canHostDepartment, canManageMeeting, canDeleteMeeting, canDeleteMeetingAsThuky } from '@/lib/permissions';
import { logAudit } from '@/lib/audit/log';
import { sendPushToUsers } from '@/lib/push/send';

const createMeetingSchema = z.object({
  title: z.string().min(3, 'Tiêu đề tối thiểu 3 ký tự'),
  summary: z.string().optional(),
  location: z.string().optional(),
  meeting_type: z.enum(['INTERNAL', 'EXTERNAL']).default('INTERNAL'),
  host_department_id: z.string().uuid(),
  start_at: z.string(),
  end_at: z.string(),
  visibility_duration_hours: z.coerce.number().nullable(),
  participant_department_ids: z.array(z.string().uuid()).default([]),
  /** Người được tag/cử đi tham dự thay — chủ yếu dùng cho họp Ngoài ngành. */
  participant_user_ids: z.array(z.string().uuid()).default([]),
  status: z.enum(['DRAFT', 'OPEN']).default('DRAFT')
});

function genMeetingCode() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `HNK-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

export type ScheduleConflict = {
  user_id: string;
  full_name: string;
  role: 'BGD' | 'MANAGER';
  meeting_id: string;
  meeting_title: string;
  start_at: string;
  end_at: string;
};

/**
 * Kiểm tra xem trong số người được tag tham dự (participant_user_ids), có ai
 * thuộc BGĐ hoặc Trưởng/phó phòng (MANAGER) đã được tag vào MỘT cuộc họp khác
 * bị TRÙNG khoảng thời gian với cuộc họp đang tạo/sửa hay không — để cảnh báo
 * ngay cho Thư ký/người tạo TRƯỚC khi họ chốt lịch, tránh xếp trùng lịch lãnh đạo.
 *
 * Dùng service-role (bỏ qua RLS) vì đây là kiểm tra LỊCH BẬN xuyên phòng ban —
 * người tạo cuộc họp có thể không có quyền XEM nội dung cuộc họp kia, nhưng vẫn
 * cần biết là lãnh đạo đang bận vào giờ đó để tránh mời trùng. Chỉ trả về tối
 * thiểu thông tin cần thiết (tên cuộc họp trùng + khung giờ), không lộ thêm gì khác.
 */
export async function checkMeetingScheduleConflictsAction(input: {
  participant_user_ids: string[];
  start_at: string;
  end_at: string;
  /** Khi SỬA cuộc họp: bỏ qua chính cuộc họp đang sửa để không tự báo trùng với chính nó. */
  exclude_meeting_id?: string;
}): Promise<{ conflicts: ScheduleConflict[] } | { error: string }> {
  await requireUser();

  if (input.participant_user_ids.length === 0 || !input.start_at || !input.end_at) {
    return { conflicts: [] };
  }
  const newStart = new Date(input.start_at).getTime();
  const newEnd = new Date(input.end_at).getTime();
  if (Number.isNaN(newStart) || Number.isNaN(newEnd) || newEnd <= newStart) {
    return { conflicts: [] };
  }

  const admin = createAdminSupabase();

  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .in('id', input.participant_user_ids)
    .in('role', ['BGD', 'MANAGER']);

  const watchedUsers = (profilesRaw ?? []) as { id: string; full_name: string; role: 'BGD' | 'MANAGER' }[];
  if (watchedUsers.length === 0) return { conflicts: [] };

  const { data: rows } = await admin
    .from('meeting_participants')
    .select('user_id, meetings:meeting_id(id, title, start_at, end_at, status)')
    .in(
      'user_id',
      watchedUsers.map((u) => u.id)
    );

  const conflicts: ScheduleConflict[] = [];
  for (const row of (rows ?? []) as any[]) {
    const m = row.meetings;
    if (!m) continue;
    if (input.exclude_meeting_id && m.id === input.exclude_meeting_id) continue;
    if (m.status === 'ARCHIVED') continue; // cuộc họp đã huỷ thì không tính là bận
    const mStart = new Date(m.start_at).getTime();
    const mEnd = new Date(m.end_at).getTime();
    if (mStart < newEnd && mEnd > newStart) {
      const user = watchedUsers.find((u) => u.id === row.user_id);
      if (!user) continue;
      conflicts.push({
        user_id: user.id,
        full_name: user.full_name,
        role: user.role,
        meeting_id: m.id,
        meeting_title: m.title,
        start_at: m.start_at,
        end_at: m.end_at
      });
    }
  }

  return { conflicts };
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

  // Họp Ngoài ngành: bắt buộc có địa điểm và ít nhất 1 người được cử đi,
  // vì mục đích chính của loại cuộc họp này là thông báo địa điểm + cử người thay mặt.
  if (data.meeting_type === 'EXTERNAL') {
    if (!data.location?.trim()) {
      return { error: 'Vui lòng nhập địa điểm cho cuộc họp ngoài ngành.' };
    }
    if (data.participant_user_ids.length === 0) {
      return { error: 'Vui lòng chọn ít nhất 1 người được cử đi tham dự.' };
    }
  }

  const supabase = createServerSupabase();

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
    location: data.location?.trim() || null,
    meeting_type: data.meeting_type,
    host_department_id: data.host_department_id,
    start_at: data.start_at,
    end_at: data.end_at,
    visibility_duration_hours: data.visibility_duration_hours,
    status: data.status,
    created_by: authId
  });

  if (error) {
    return { error: 'Không tạo được cuộc họp: ' + error.message };
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

  if (data.participant_user_ids.length > 0) {
    const rows = data.participant_user_ids.map((user_id) => ({
      meeting_id: meeting.id,
      user_id,
      assigned_by: authId
    }));
    await supabase.from('meeting_participants').insert(rows);

    // Chỉ báo ngay nếu cuộc họp mở luôn ở trạng thái OPEN. Nếu tạo ở dạng Nháp,
    // thông báo sẽ được gửi sau, vào lúc Thư ký/BGD "Duyệt tạo" (xem updateMeetingStatusAction).
    if (data.status === 'OPEN') {
      await sendPushToUsers(data.participant_user_ids, {
        title: 'Bạn được cử tham dự cuộc họp mới',
        body: meeting.title,
        url: `/meetings/${meeting.id}`
      });
    }
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

  // Nếu vừa Duyệt tạo (Nháp -> Mở), báo cho những người được cử tham dự riêng lẻ
  // (meeting_participants) — trường hợp cuộc họp được tạo ở dạng Nháp trước đó nên
  // chưa được báo lúc tạo (xem createMeetingAction).
  if (status === 'OPEN' && meeting.status === 'DRAFT') {
    const { data: participants } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meetingId);
    const userIds = (participants ?? []).map((p) => p.user_id).filter(Boolean);
    if (userIds.length > 0) {
      await sendPushToUsers(userIds, {
        title: 'Cuộc họp bạn được cử tham dự đã được duyệt',
        body: meeting.title,
        url: `/meetings/${meetingId}`
      });
    }
  }

  await logAudit({ userId: authId, action: `SET_MEETING_${status}`, entityType: 'meeting', entityId: meetingId });
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

const updateMeetingInfoSchema = z.object({
  title: z.string().min(3, 'Tiêu đề tối thiểu 3 ký tự'),
  summary: z.string().optional(),
  location: z.string().optional(),
  start_at: z.string(),
  end_at: z.string()
});

/**
 * Sửa thông tin cơ bản của cuộc họp (tiêu đề, thời gian, ghi chú, địa điểm nếu
 * là họp ngoài ngành). Dùng lại đúng quyền quản lý (canManageMeeting): ADMIN,
 * người tạo cuộc họp, hoặc MANAGER/BGD/THUKY của phòng chủ trì. KHÔNG giới hạn
 * theo trạng thái Nháp/Đã duyệt — được sửa kể cả sau khi đã Duyệt tạo cuộc họp,
 * chỉ khoá lại khi cuộc họp đã Lưu trữ.
 */
export async function updateMeetingInfoAction(meetingId: string, input: z.infer<typeof updateMeetingInfoSchema>) {
  const { authId, profile } = await requireUser();
  const supabase = createServerSupabase();

  const { data: meeting } = await supabase.from('meetings').select('*').eq('id', meetingId).single();
  if (!meeting) return { error: 'Không tìm thấy cuộc họp.' };

  if (!canManageMeeting(meeting as any, profile)) {
    return { error: 'Bạn không có quyền sửa cuộc họp này.' };
  }
  if (meeting.status === 'ARCHIVED') {
    return { error: 'Cuộc họp đã Lưu trữ, không thể sửa thông tin nữa.' };
  }

  const parsed = updateMeetingInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' };
  }
  const { title, summary, location, start_at, end_at } = parsed.data;

  if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
    return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };
  }

  const { error } = await supabase
    .from('meetings')
    .update({
      title: title.trim(),
      summary: summary?.trim() || null,
      location: location?.trim() || null,
      start_at,
      end_at
    })
    .eq('id', meetingId);
  if (error) return { error: error.message };

  await logAudit({
    userId: authId,
    action: 'UPDATE_MEETING_INFO',
    entityType: 'meeting',
    entityId: meetingId,
    metadata: { title }
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath('/dashboard');
  revalidatePath('/meetings');
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

  if (!canDeleteMeeting(meeting as any, profile) && !canDeleteMeetingAsThuky(meeting as any, profile)) {
    return {
      error:
        'Bạn không có quyền xoá cuộc họp này. Chỉ Quản trị viên (ADMIN, khi còn Nháp) hoặc Thư ký ' +
        'phụ trách cuộc họp (mọi trạng thái, trừ đã Lưu trữ) mới được xoá — hãy dùng chức năng ' +
        '"Huỷ cuộc họp" nếu chỉ muốn dừng hiệu lực mà vẫn giữ dữ liệu.'
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
