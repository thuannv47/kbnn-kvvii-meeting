'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/meetings', icon: '📅', label: 'Cuộc họp' },
  { href: '/search', icon: '🔎', label: 'Tìm kiếm' },
  { href: '/departments', icon: '🏢', label: 'Phòng ban' }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line flex justify-around py-2 z-20">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
              active ? 'text-gold font-semibold' : 'text-inksoft'
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
