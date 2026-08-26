import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const AUTO_CLOSE_AFTER_HOURS = 48;

/**
 * Cron job (xem vercel.json) — tự động chuyển các cuộc họp đang "Mở" (OPEN)
 * sang "Đã đóng" (CLOSED) khi đã qua 48 giờ kể từ end_at.
 *
 * Đây là cơ chế THAY THẾ cho việc phải bấm tay nút "Đóng"/"Lưu trữ": mặc định
 * sau khi cuộc họp diễn ra xong 48 giờ, hệ thống tự chuyển trạng thái mà
 * không cần thao tác thủ công. Chạy bằng service role (bỏ qua RLS) vì cần
 * cập nhật cuộc họp của MỌI phòng ban, không chỉ của một người dùng cụ thể.
 *
 * Bảo vệ: nếu đặt biến môi trường CRON_SECRET, request phải kèm header
 * "Authorization: Bearer <CRON_SECRET>" thì mới được chạy. Vercel Cron tự
 * gửi header này khi bật "Protect Cron Jobs" trong cài đặt dự án.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  const cutoffIso = new Date(Date.now() - AUTO_CLOSE_AFTER_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('meetings')
    .update({ status: 'CLOSED' })
    .eq('status', 'OPEN')
    .lt('end_at', cutoffIso)
    .select('id, code, title, end_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ closed_count: data?.length ?? 0, closed: data ?? [] });
}
