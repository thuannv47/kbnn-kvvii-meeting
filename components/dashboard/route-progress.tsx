'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thanh loading mỏng ở đầu trang, hiện NGAY khi người dùng bấm vào 1 link nội bộ
 * (menu, "Xem chi tiết", v.v.) và tự ẩn khi trang mới đã tải xong.
 *
 * App đôi khi phản hồi chậm (chờ Supabase/B2), nên nếu không có dấu hiệu gì thì
 * người dùng dễ tưởng mình bấm trượt và bấm lại nhiều lần. Bar này giải quyết
 * đúng vấn đề đó mà không cần sửa từng Link một.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.href === window.location.href) return;

      setActive(true);
      // An toàn: nếu vì lý do gì đó pathname không đổi (VD lỗi điều hướng),
      // tự tắt bar sau 6s để không bị kẹt mãi trên màn hình.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setActive(false), 6000);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    setActive(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname]);

  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-gold/15 overflow-hidden">
      <div className="h-full w-1/3 bg-gold route-progress-bar" />
    </div>
  );
}
