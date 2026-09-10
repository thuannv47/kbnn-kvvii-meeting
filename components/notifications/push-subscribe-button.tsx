'use client';

import { useEffect, useState } from 'react';
import { savePushSubscriptionAction, deletePushSubscriptionAction } from '@/actions/push.actions';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Support = 'checking' | 'unsupported' | 'supported';

export default function PushSubscribeButton() {
  const [support, setSupport] = useState<Support>('checking');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isIosStandaloneMissing, setIsIosStandaloneMissing] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (isIos && !isStandalone) {
      // Safari/iOS chỉ cho phép Push khi web đã được "Thêm vào Màn hình chính".
      setIsIosStandaloneMissing(true);
      setSupport('unsupported');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupport('unsupported');
      return;
    }

    setSupport('supported');
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, []);

  async function handleEnable() {
    setLoading(true);
    setMessage(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setMessage('Hệ thống chưa cấu hình khoá VAPID_PUBLIC_KEY, liên hệ quản trị viên.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Bạn đã từ chối quyền thông báo. Vào cài đặt trình duyệt để bật lại nếu muốn dùng.');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscriptionAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }
      });

      if (res.error) {
        setMessage(res.error);
        return;
      }
      setSubscribed(true);
      setMessage('Đã bật thông báo trên thiết bị này.');
    } catch (err: any) {
      setMessage('Không bật được thông báo: ' + (err?.message || 'Lỗi không xác định.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage('Đã tắt thông báo trên thiết bị này.');
    } catch (err: any) {
      setMessage('Không tắt được thông báo: ' + (err?.message || 'Lỗi không xác định.'));
    } finally {
      setLoading(false);
    }
  }

  if (support === 'checking') return null;

  if (support === 'unsupported') {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-1">Thông báo cuộc họp</h3>
        {isIosStandaloneMissing ? (
          <p className="text-sm text-inksoft">
            Để nhận thông báo trên iPhone/iPad, trước tiên hãy thêm ứng dụng vào Màn hình chính: mở
            Safari → bấm nút Chia sẻ (hình vuông có mũi tên) → chọn{' '}
            <strong>&quot;Thêm vào MH chính&quot;</strong>. Sau đó mở lại app từ biểu tượng vừa thêm và bật
            thông báo tại đây.
          </p>
        ) : (
          <p className="text-sm text-inksoft">Trình duyệt của bạn không hỗ trợ thông báo đẩy.</p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-1">Thông báo cuộc họp</h3>
      <p className="text-sm text-inksoft mb-3">
        Bật để nhận thông báo ngay khi bạn được cử tham dự một cuộc họp mới, kể cả khi không mở app.
      </p>
      {subscribed ? (
        <button onClick={handleDisable} disabled={loading} className="btn text-sm">
          {loading ? 'Đang xử lý…' : 'Tắt thông báo trên thiết bị này'}
        </button>
      ) : (
        <button onClick={handleEnable} disabled={loading} className="btn-primary text-sm">
          {loading ? 'Đang bật…' : 'Bật thông báo'}
        </button>
      )}
      {message && <p className="text-xs text-inksoft mt-2">{message}</p>}
    </div>
  );
}
