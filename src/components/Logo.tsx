import Image from 'next/image';
import Link from 'next/link';

/** Logo Flomal: biểu tượng chữ L + lá (ảnh trắng nền trong) và chữ thương hiệu. */
export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Flomal — Trang chủ">
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#2f6bff] to-[#22d39a] shadow-glow transition group-hover:scale-105">
        <Image src="/brand/flomal-mark-white.png" alt="" width={22} height={22} className="h-[22px] w-auto" priority />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[17px] font-bold tracking-[0.18em] text-white">FLOMAL</span>
          <span className="mt-1 hidden text-[10.5px] font-medium tracking-wide text-slate-500 sm:block">
            Bạn tìm hoa, <span className="text-emerald-700">tôi có hoa</span>
          </span>
        </span>
      )}
    </Link>
  );
}
