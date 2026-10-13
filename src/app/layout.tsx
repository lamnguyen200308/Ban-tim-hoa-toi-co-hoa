import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: { default: 'Flomal · Bạn tìm hoa, tôi có hoa', template: '%s · Flomal' },
  description: 'Tự thiết kế bó hoa 3D và nhận báo giá cạnh tranh từ các shop hoa.',
};

export const viewport: Viewport = { themeColor: '#070b14', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Một font duy nhất cho toàn site */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="mt-20 border-t border-white/[0.07] bg-[#05080f]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row">
            <div className="flex items-center gap-3">
              <Image src="/brand/flomal-logo-white.png" alt="Flomal" width={44} height={44} className="h-11 w-auto opacity-90" />
              <p className="max-w-xs text-sm text-slate-500">
                Bạn tìm hoa, <span className="text-emerald-700">tôi có hoa</span> — kết nối người yêu hoa với shop hoa tốt nhất.
              </p>
            </div>
            <nav aria-label="Liên kết cuối trang" className="flex gap-6 text-sm text-slate-500">
              <Link href="/thiet-ke" className="transition hover:text-white">Thiết kế 3D</Link>
              <Link href="/mau-da-luu" className="transition hover:text-white">Mẫu đã lưu</Link>
              <Link href="/cho-hoa" className="transition hover:text-white">Chợ hoa</Link>
            </nav>
          </div>
          <p className="border-t border-white/[0.05] py-4 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Flomal
          </p>
        </footer>
      </body>
    </html>
  );
}
