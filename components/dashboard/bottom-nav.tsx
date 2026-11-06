'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconCalendar, IconCalendarDays, IconSearch, IconUser } from '@/components/ui/icons';

const items = [
  { href: '/dashboard', icon: IconHome, label: 'Trang chủ' },
  { href: '/meetings', icon: IconCalendar, label: 'Cuộc họp' },
  { href: '/meetings/calendar', icon: IconCalendarDays, label: 'Lịch họp' },
  { href: '/search', icon: IconSearch, label: 'Tìm kiếm' },
  { href: '/account', icon: IconUser, label: 'Tài khoản' }
];

export default function BottomNav() {
  const pathname = usePathname();

  // Tìm tab khớp CỤ THỂ NHẤT với đường dẫn hiện tại (href dài nhất trong số các
  // href khớp) — tránh trường hợp "/meetings/calendar" vừa khớp "/meetings"
  // (Cuộc họp) vừa khớp "/meetings/calendar" (Lịch họp) khiến cả 2 tab cùng
  // được tô màu active một lúc (bug trùng màu khi chuyển giữa 2 tab này).
  const matching = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const activeHref = matching.sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line flex justify-around py-1.5 z-20">
      {items.map((item) => {
        const active = item.href === activeHref;
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
