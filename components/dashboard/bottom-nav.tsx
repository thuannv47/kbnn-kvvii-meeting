'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Profile } from '@/types/user';
import { canManageOrg } from '@/lib/permissions';
import { IconHome, IconCalendar, IconSearch, IconUser, IconBuilding, IconShield, IconDotsVertical } from '@/components/ui/icons';

const mainItems = [
  { href: '/dashboard', icon: IconHome, label: 'Trang chủ' },
  { href: '/meetings', icon: IconCalendar, label: 'Cuộc họp' },
  { href: '/search', icon: IconSearch, label: 'Tìm kiếm' },
  { href: '/account', icon: IconUser, label: 'Cá nhân' }
];

export default function BottomNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const moreItems = [
    { href: '/departments', icon: IconBuilding, label: 'Phòng ban' },
    ...(canManageOrg(profile)
      ? [
          { href: '/users', icon: IconUser, label: 'Người dùng' },
          { href: '/admin', icon: IconShield, label: 'Quản trị / Audit' }
        ]
      : [])
  ];
  const moreActive = moreItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-20" ref={popupRef}>
      {open && (
        <div className="absolute bottom-full right-3 mb-2 bg-surface border border-line rounded-xl shadow-lg overflow-hidden min-w-[180px]">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm border-b border-line last:border-0 ${
                  active ? 'text-gold font-semibold bg-gold/5' : 'text-ink hover:bg-paper2'
                }`}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      <nav className="bg-surface border-t border-line flex justify-around py-1.5">
        {mainItems.map((item) => {
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
        {moreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] transition-colors ${
              moreActive || open ? 'text-gold font-semibold' : 'text-inksoft'
            }`}
          >
            <IconDotsVertical size={20} />
            Thêm
          </button>
        )}
      </nav>
    </div>
  );
}
