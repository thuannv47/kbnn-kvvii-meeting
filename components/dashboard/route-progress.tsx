'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import LogoSpinner from '@/components/ui/logo-spinner';

/**
 * Hiệu ứng loading khi chuyển trang, gồm 2 phần:
 * 1) Thanh mỏng ở đầu trang — phản hồi tức thì ngay khi bấm link.
 * 2) Lớp phủ làm MỜ toàn bộ nội dung phía sau (backdrop-blur), cùng vòng
 *    tròn logo xoay 2D nổi giữa màn hình — DÙNG CHUNG component LogoSpinner
 *    với màn hình loading.tsx của từng trang, để toàn bộ hiệu ứng "đang tải"
 *    trong app đồng nhất 1 kiểu duy nhất, không còn chỗ lật 3D chỗ đứng yên.
 * Cả 2 tự ẩn khi trang mới đã tải xong (pathname đổi) hoặc sau 6s an toàn.
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
        <LogoSpinner size={52} />
      </div>
    </>
  );
}
