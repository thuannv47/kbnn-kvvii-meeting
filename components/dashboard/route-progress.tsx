'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hiệu ứng loading khi chuyển trang, gồm 3 phần:
 * 1) Thanh mỏng ở đầu trang — phản hồi tức thì ngay khi bấm link.
 * 2) Lớp phủ làm MỜ toàn bộ nội dung phía sau (backdrop-blur) — nhấn mạnh là
 *    trang đang thay đổi, tránh người dùng đọc/thao tác nhầm vào nội dung cũ.
 * 3) Huy hiệu logo KBNN nổi giữa màn hình, luôn RÕ NÉT (không bị mờ theo) và
 *    tự LẬT từ trái qua phải liên tục — cùng ý tưởng với các app quen thuộc
 *    (hiện icon thương hiệu lúc đang tải).
 * Cả 3 tự ẩn khi trang mới đã tải xong (pathname đổi) hoặc sau 6s an toàn.
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
    <>
      <div className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-gold/15 overflow-hidden">
        <div className="h-full w-1/3 bg-gold route-progress-bar" />
      </div>
      {/* Lớp phủ làm mờ TOÀN BỘ nội dung phía sau (backdrop-blur chỉ làm mờ
          những gì nằm ở DƯỚI lớp này, không ảnh hưởng logo — logo nằm ở lớp
          riêng bên trên nên vẫn nét 100%). */}
      <div className="fixed inset-0 z-[65] bg-white/40 backdrop-blur-sm route-loading-fade" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-full shadow-lg border border-line p-3" style={{ perspective: 600 }}>
          <img
            src="/logo-kbnn.png"
            alt="Đang tải"
            width={40}
            height={40}
            className="logo-loading-flip"
            style={{ objectFit: 'contain' }}
          />
        </div>
      </div>
    </>
  );
}
