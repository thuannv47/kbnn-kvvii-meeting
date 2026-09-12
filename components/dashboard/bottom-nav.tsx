'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconCalendarDays, IconSearch, IconUser } from '@/components/ui/icons';

// Trước đây có "Cuộc họp" (/meetings) ở đây, nhưng mục này TRÙNG với lưới liên kết
// nhanh ngay trên Trang chủ (Cuộc họp, Tìm kiếm, Phòng ban, Tài khoản) — 4 icon đó
// đã đủ để vào danh sách cuộc họp. Thay bằng "Lịch họp" (dạng lịch theo ngày, xem
// nhanh cuộc họp trong tháng) để thanh điều hướng dưới có tính năng RIÊNG, không lặp
// lại lối vào đã có sẵn ở lưới liên kết. Người dùng vẫn vào được danh sách cuộc họp
// dạng bảng qua lưới liên kết ở Trang chủ, hoặc nút "Xem dạng danh sách" trong
// chính trang Lịch họp.
const items = [
  { href: '/dashboard', icon: IconHome, label: 'Trang chủ' },
  { href: '/meetings/calendar', icon: IconCalendarDays, label: 'Lịch họp' },
  { href: '/search', icon: IconSearch, label: 'Tìm kiếm' },
  { href: '/account', icon: IconUser, label: 'Tài khoản' }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line flex justify-around py-1.5 z-20">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] transition-colors ${
              active ? 'text-gold font-semibold' : 'text-inksoft'
            }`}
          >
            <Icon size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
