'use server';

import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/current-user';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

/** Lưu (hoặc cập nhật) subscription của THIẾT BỊ hiện tại cho người dùng đang đăng nhập. */
export async function savePushSubscriptionAction(input: z.infer<typeof subscriptionSchema>) {
  const { authId } = await requireUser();

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Dữ liệu subscription không hợp lệ.' };
  }
  const { endpoint, keys } = parsed.data;

  const supabase = createServerSupabase();
  // Dùng "endpoint" (duy nhất theo trình duyệt/thiết bị) làm khoá upsert — 1 người
  // dùng nhiều thiết bị thì mỗi thiết bị có 1 dòng riêng.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: authId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );

  if (error) return { error: 'Không lưu được đăng ký thông báo: ' + error.message };
  return { success: true };
}

/** Gỡ đăng ký nhận thông báo trên thiết bị hiện tại (khi người dùng tắt trong Cài đặt). */
export async function deletePushSubscriptionAction(endpoint: string) {
  const { authId } = await requireUser();
  const supabase = createServerSupabase();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', authId);
  return { success: true };
}
