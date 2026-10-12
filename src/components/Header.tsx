'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/lib/useProfile';

const NAV = [
  { href: '/thiet-ke', label: 'Thiết kế 3D' },
  { href: '/cho-hoa', label: 'Chợ hoa' },
];

export default function Header() {
  const pathname = usePathname() ?? '/';
  const { user, profile } = useProfile();

  return (
    <header className="sticky top-0 z-30 border-b border-rose-100 bg-[#fdf6f0]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-rose-700">
          <span className="text-2xl" aria-hidden>🌸</span>
          <span className="hidden leading-tight sm:inline">Bạn tìm hoa, tôi có hoa</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3 py-2 font-medium transition ${
                pathname.startsWith(n.href) ? 'bg-rose-100 text-rose-700' : 'text-stone-600 hover:text-rose-700'
              }`}
            >
              {n.label}
            </Link>
          ))}
          {user ? (
            <Link href="/tai-khoan" className="btn-outline !px-3 !py-2">
              <span aria-hidden>{profile?.role === 'shop' ? '🏪' : '👤'}</span>
              <span className="hidden max-w-[10rem] truncate sm:inline">{profile?.display_name || 'Tài khoản'}</span>
            </Link>
          ) : (
            <Link href="/dang-nhap" className="btn-primary !px-4 !py-2">
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
