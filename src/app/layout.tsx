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
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main>{children}</main>
        <footer className="mt-16 border-t border-rose-100 py-8 text-center text-sm text-stone-500">
          <p>🌸 Bạn tìm hoa, tôi có hoa · Kết nối người yêu hoa với shop hoa tốt nhất</p>
          <p className="mt-1">
            <Link href="/thiet-ke" className="hover:text-rose-700">Thiết kế 3D</Link> ·{' '}
            <Link href="/cho-hoa" className="hover:text-rose-700">Chợ hoa</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
