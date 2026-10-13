import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Bạn tìm hoa, tôi có hoa',
  description: 'Tự thiết kế bó hoa 3D và nhận báo giá cạnh tranh từ các shop hoa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main>{children}</main>
        <footer className="mt-16 bg-[var(--ink)] py-8 text-center text-sm text-slate-400">
          <p>🌸 Bạn tìm hoa, <span className="text-emerald-400">tôi có hoa</span> · Kết nối người yêu hoa với shop hoa tốt nhất</p>
          <p className="mt-1">
            <Link href="/thiet-ke" className="hover:text-white">Thiết kế 3D</Link> ·{' '}
            <Link href="/mau-da-luu" className="hover:text-white">Mẫu đã lưu</Link> ·{' '}
            <Link href="/cho-hoa" className="hover:text-white">Chợ hoa</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
