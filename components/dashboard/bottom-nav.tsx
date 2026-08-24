'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', icon: '🏠', label: 'Trang chủ' },
  { href: '/meetings', icon: '📅', label: 'Cuộc họp' },
  { href: '/search', icon: '🔎', label: 'Tìm kiếm' },
  { href: '/departments', icon: '🏢', label: 'Phòng ban' }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line flex justify-around py-2 z-20">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3.5 py-1.5 text-[11px] transition-colors ${
              active ? 'bg-gold-soft text-gold font-semibold' : 'text-inksoft'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
