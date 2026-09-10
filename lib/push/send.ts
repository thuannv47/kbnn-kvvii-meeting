import 'server-only';
import webpush from 'web-push';
import { createAdminSupabase } from '@/lib/supabase/admin';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@kbnn-kvvii.gov.vn';

  if (!publicKey || !privateKey) {
    // Chưa cấu hình VAPID key -> không throw lỗi làm hỏng luồng tạo/duyệt cuộc họp,
    // chỉ bỏ qua việc gửi push (xem log ở nơi gọi).
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Đường dẫn tương đối sẽ mở khi bấm vào thông báo, ví dụ /meetings/xxx */
  url?: string;
  tag?: string;
};

/**
 * Gửi push tới TẤT CẢ thiết bị đã đăng ký của 1 người dùng.
 * Tự động xoá khỏi DB các subscription đã hết hạn/bị thu hồi (lỗi 404/410 từ trình duyệt).
 * Không throw lỗi ra ngoài — gọi ở đâu cũng nên coi đây là "best effort", không chặn
 * luồng nghiệp vụ chính (tạo cuộc họp) nếu gửi push thất bại.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureVapid();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn('[push] Bỏ qua gửi thông báo: chưa cấu hình VAPID_PRIVATE_KEY/NEXT_PUBLIC_VAPID_PUBLIC_KEY.');
    return;
  }

  const supabase = createAdminSupabase();
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription không còn hiệu lực (gỡ app / xoá quyền thông báo) -> dọn DB.
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('[push] Gửi thông báo thất bại cho user', userId, err?.message || err);
        }
      }
    })
  );
}

/** Gửi push tới nhiều người dùng cùng lúc — dùng khi có danh sách participant_user_ids. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload)));
}
