'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/lib/useProfile';

type Tab = { href: string; label: string; icon: string; match: (p: string) => boolean; hideForShop?: boolean; adminOnly?: boolean };

const TABS: Tab[] = [
  { href: '/', label: 'Trang chủ', icon: '🏠', match: (p) => p === '/' },
  { href: '/thiet-ke', label: 'Thiết kế 3D', icon: '🎨', match: (p) => p.startsWith('/thiet-ke') },
  { href: '/mau-da-luu', label: 'Mẫu đã lưu', icon: '💾', match: (p) => p.startsWith('/mau-da-luu'), hideForShop: true },
  {
    href: '/cho-hoa',
    label: 'Chợ hoa',
    icon: '🛎️',
    match: (p) => p.startsWith('/cho-hoa') && !p.startsWith('/cho-hoa/dang-yeu-cau'),
  },
  {
    href: '/cho-hoa/dang-yeu-cau',
    label: 'Đăng yêu cầu',
    icon: '📝',
    match: (p) => p.startsWith('/cho-hoa/dang-yeu-cau'),
    hideForShop: true,
  },
  {
    href: '/tai-khoan',
    label: 'Tài khoản',
    icon: '👤',
    match: (p) => p.startsWith('/tai-khoan') || p.startsWith('/dang-nhap') || p.startsWith('/don-hang'),
  },
  { href: '/quan-tri', label: 'Quản trị', icon: '🛠️', match: (p) => p.startsWith('/quan-tri'), adminOnly: true },
];

export default function Header() {
  const pathname = usePathname() ?? '/';
  const { user, profile } = useProfile();
  const isShop = profile?.role === 'shop';
  const tabs = TABS.filter((t) => !(isShop && t.hideForShop) && (!t.adminOnly || profile?.is_admin));

  return (
    <header className="sticky top-0 z-30 bg-[var(--ink)] text-white shadow-lg shadow-black/10">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-400 text-lg" aria-hidden>
            🌸
          </span>
          <span className="hidden font-display text-lg leading-tight sm:inline">
            Bạn tìm hoa, <span className="text-emerald-400">tôi có hoa</span>
          </span>
        </Link>
        <div className="ml-auto">
          {user ? (
            <Link
              href="/tai-khoan"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15"
            >
              <span aria-hidden>{isShop ? '🏪' : '👤'}</span>
              <span className="max-w-[10rem] truncate">{profile?.display_name || 'Tài khoản'}</span>
            </Link>
          ) : (
            <Link href="/dang-nhap" className="btn-accent !px-4 !py-2">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>

      <nav aria-label="Điều hướng chính" className="border-t border-white/10 bg-[var(--ink-soft)]">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:px-4 md:[mask-image:none]">
          {tabs.map((t) => {
            const active = t.match(pathname);
            return (
              <li key={t.href} className="shrink-0">
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-semibold transition ${
                    active ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span aria-hidden>{t.icon}</span>
                  {t.label}
                  <span
                    className={`absolute inset-x-2 bottom-0 h-[3px] rounded-t-full transition ${
                      active ? 'bg-gradient-to-r from-blue-500 to-emerald-400' : 'bg-transparent'
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
