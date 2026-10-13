'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  Box,
  FilePlus2,
  House,
  ShieldCheck,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { useProfile } from '@/lib/useProfile';

type Tab = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean; hideForShop?: boolean; adminOnly?: boolean };

const TABS: Tab[] = [
  { href: '/', label: 'Trang chủ', icon: House, match: (p) => p === '/' },
  { href: '/thiet-ke', label: 'Thiết kế 3D', icon: Box, match: (p) => p.startsWith('/thiet-ke') },
  { href: '/mau-da-luu', label: 'Mẫu đã lưu', icon: Bookmark, match: (p) => p.startsWith('/mau-da-luu'), hideForShop: true },
  {
    href: '/cho-hoa',
    label: 'Chợ hoa',
    icon: Store,
    match: (p) => p.startsWith('/cho-hoa') && !p.startsWith('/cho-hoa/dang-yeu-cau'),
  },
  {
    href: '/cho-hoa/dang-yeu-cau',
    label: 'Đăng yêu cầu',
    icon: FilePlus2,
    match: (p) => p.startsWith('/cho-hoa/dang-yeu-cau'),
    hideForShop: true,
  },
  {
    href: '/tai-khoan',
    label: 'Tài khoản',
    icon: UserRound,
    match: (p) => p.startsWith('/tai-khoan') || p.startsWith('/dang-nhap') || p.startsWith('/don-hang'),
  },
  { href: '/quan-tri', label: 'Quản trị', icon: ShieldCheck, match: (p) => p.startsWith('/quan-tri'), adminOnly: true },
];

export default function Header() {
  const pathname = usePathname() ?? '/';
  const { user, profile } = useProfile();
  const isShop = profile?.role === 'shop';
  const tabs = TABS.filter((t) => !(isShop && t.hideForShop) && (!t.adminOnly || profile?.is_admin));

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070b14]/75 text-white backdrop-blur-xl supports-[backdrop-filter]:bg-[#070b14]/60">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Logo />

        {/* Điều hướng: desktop nằm cùng hàng với logo */}
        <nav aria-label="Điều hướng chính" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {tabs.map((t) => (
              <NavItem key={t.href} tab={t} active={t.match(pathname)} />
            ))}
          </ul>
        </nav>

        <div className="ml-auto lg:ml-0">
          {user ? (
            <Link
              href="/tai-khoan"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-sm font-semibold transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#2f6bff] to-[#22d39a] text-xs font-bold uppercase">
                {(profile?.display_name || 'T').trim().charAt(0)}
              </span>
              <span className="max-w-[9rem] truncate">{profile?.display_name || 'Tài khoản'}</span>
              {isShop && <span className="chip-green !px-1.5 !py-0 text-[10px]">Shop</span>}
            </Link>
          ) : (
            <Link href="/dang-nhap" className="btn-accent !px-4 !py-2">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>

      {/* Điều hướng: điện thoại / máy tính bảng — hàng cuộn ngang */}
      <nav aria-label="Điều hướng chính (di động)" className="border-t border-white/[0.06] lg:hidden">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-1.5 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:px-4">
          {tabs.map((t) => (
            <NavItem key={t.href} tab={t} active={t.match(pathname)} />
          ))}
        </ul>
      </nav>
    </header>
  );
}

function NavItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <li className="shrink-0">
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
          active ? 'bg-white/[0.07] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
        }`}
      >
        <Icon aria-hidden className={`h-4 w-4 ${active ? 'text-[#5b9bff]' : ''}`} strokeWidth={1.8} />
        {tab.label}
        {active && (
          <span className="absolute inset-x-3 -bottom-[7px] h-px bg-gradient-to-r from-transparent via-[#3d8bff] to-transparent lg:-bottom-[13px]" />
        )}
      </Link>
    </li>
  );
}
