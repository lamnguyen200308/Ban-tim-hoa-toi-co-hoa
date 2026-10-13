import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  Bookmark,
  Box,
  EyeOff,
  FilePlus2,
  Handshake,
  Radio,
  Receipt,
  Rotate3d,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react';

type Step = { icon: LucideIcon; title: string; text: string };

const STEPS_CUSTOMER: Step[] = [
  { icon: Box, title: 'Tự thiết kế', text: 'Chọn hoa, giấy gói, kiểu gói và ruy băng. Xoay bó hoa 3D để ngắm mọi góc.' },
  { icon: FilePlus2, title: 'Đăng yêu cầu', text: 'Đăng thiết kế hoặc ảnh mẫu kèm mô tả, ngân sách và ngày cần hoa.' },
  { icon: BadgePercent, title: 'Chọn giá tốt nhất', text: 'Các shop ẩn danh gửi báo giá cạnh tranh. Chấp nhận rồi mở liên hệ shop.' },
];

const STEPS_SHOP: Step[] = [
  { icon: Search, title: 'Xem yêu cầu', text: 'Danh sách khách đang tìm hoa trong khu vực của bạn, cập nhật liên tục.' },
  { icon: Tag, title: 'Báo giá', text: 'Gửi giá và lời nhắn. Có thể hạ giá khi thấy đối thủ báo thấp hơn.' },
  { icon: Handshake, title: 'Chốt đơn', text: 'Được chấp nhận → mở thông tin liên hệ của khách và bắt đầu chuẩn bị.' },
];

const FEATURES: (Step & { span?: string })[] = [
  {
    icon: Rotate3d,
    title: 'Studio 3D ngay trên trình duyệt',
    text: 'Kéo thả từng cành, đổi giấy gói, ruy băng, xoay 360° — giá cập nhật tức thì theo từng thay đổi.',
    span: 'md:col-span-2',
  },
  { icon: Radio, title: 'Báo giá thời gian thực', text: 'Báo giá mới hiện ngay, không cần tải lại trang.' },
  { icon: EyeOff, title: 'Ẩn danh hai chiều', text: 'Khách và shop không thấy thông tin của nhau cho tới khi chốt.' },
  { icon: Bookmark, title: 'Lưu mẫu không cần tài khoản', text: 'Thiết kế và lưu ngay trên trình duyệt, đăng nhập khi muốn đăng.' },
  { icon: Receipt, title: 'Báo giá chi tiết', text: 'Tách rõ giá hoa, công thiết kế, phí giao và hạn hiệu lực.' },
  {
    icon: ShieldCheck,
    title: 'Đơn hàng có kiểm soát',
    text: 'Theo dõi trạng thái từng bước, lịch sử thay đổi và khiếu nại kèm ảnh bằng chứng.',
    span: 'md:col-span-2',
  },
];

/* Số liệu minh hoạ trên thẻ hero (không phải dữ liệu thật) */
const SAMPLE_BIDS = [
  { shop: 'Shop A', price: '420.000 ₫', w: 'w-[92%]' },
  { shop: 'Shop B', price: '399.000 ₫', w: 'w-[84%]' },
  { shop: 'Shop C', price: '385.000 ₫', w: 'w-[76%]', best: true },
];

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      {/* ───────── HERO ───────── */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
        <div>
          <span className="eyebrow">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Sàn hoa tươi minh bạch giá
          </span>
          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] text-white sm:text-6xl">
            Bạn tìm hoa,
            <br />
            <span className="text-gradient">tôi có hoa.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Quá nhiều shop hoa, không biết mua ở đâu rẻ và đẹp? Tự thiết kế bó hoa trong không gian 3D, xem giá ngay
            lập tức — rồi để các shop hoa cạnh tranh báo giá cho bạn.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/thiet-ke" className="btn-primary !px-6 !py-3 text-[15px]">
              <Box className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              Thiết kế bó hoa 3D
            </Link>
            <Link href="/cho-hoa" className="btn-outline !px-6 !py-3 text-[15px]">
              Vào Chợ hoa
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </Link>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 divide-x divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur">
            {[
              ['360°', 'Xem bó hoa 3D'],
              ['0 ₫', 'Đăng yêu cầu'],
              ['Ẩn danh', 'Hai chiều'],
            ].map(([v, l]) => (
              <div key={l} className="px-4 py-3.5">
                <dt className="sr-only">{l}</dt>
                <dd className="text-lg font-bold text-white sm:text-xl">{v}</dd>
                <dd className="mt-0.5 text-xs text-slate-500">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Bảng điều khiển minh hoạ */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(47,107,255,0.35),transparent)] blur-2xl" />
          <div className="card-glow overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="ml-3 text-xs font-medium text-slate-500">flomal / studio-3d</span>
              <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Minh hoạ
              </span>
            </div>

            <div className="relative grid aspect-[5/4] place-items-center bg-[radial-gradient(circle_at_50%_60%,rgba(47,107,255,0.18),transparent_60%)]">
              {/* lưới sàn phối cảnh */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 [background:linear-gradient(rgba(61,123,255,.25)_1px,transparent_1px)_0_0/100%_28px,linear-gradient(90deg,rgba(61,123,255,.25)_1px,transparent_1px)_0_0/28px_100%] [mask-image:linear-gradient(to_top,black,transparent)] [transform:perspective(420px)_rotateX(62deg)] [transform-origin:bottom]" />
              {/* vòng quỹ đạo */}
              <div className="absolute h-[68%] w-[68%] animate-spinslow rounded-full border border-dashed border-blue-500/30" />
              <div className="absolute h-[48%] w-[48%] rounded-full border border-emerald-500/20" />
              <div className="relative grid h-28 w-28 animate-float place-items-center rounded-3xl bg-gradient-to-br from-[#2f6bff] to-[#22d39a] shadow-[0_0_80px_-10px_rgba(47,107,255,0.8)]">
                <Image src="/brand/flomal-mark-white.png" alt="" width={64} height={64} className="h-16 w-auto" priority />
              </div>

              <div className="absolute right-4 top-4 rounded-xl border border-white/10 bg-[#0b1324]/80 px-3 py-2 text-xs backdrop-blur">
                <p className="flex items-center gap-1.5 font-semibold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 5 shop đã báo giá
                </p>
              </div>
              <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-[#0b1324]/80 px-3 py-2 backdrop-blur">
                <p className="text-[11px] text-slate-500">Báo giá thấp nhất</p>
                <p className="text-lg font-bold text-white">385.000 ₫</p>
              </div>
            </div>

            <ul className="space-y-2.5 border-t border-white/[0.06] p-4">
              {SAMPLE_BIDS.map((b) => (
                <li key={b.shop} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-500">{b.shop}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`block h-full rounded-full ${b.w} ${
                        b.best ? 'bg-gradient-to-r from-[#22d39a] to-[#22d3ee]' : 'bg-gradient-to-r from-[#2f6bff] to-[#5b9bff]'
                      }`}
                    />
                  </span>
                  <span className={`font-semibold tabular-nums ${b.best ? 'text-emerald-700' : 'text-slate-700'}`}>{b.price}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── TÍNH NĂNG ───────── */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Nền tảng</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Mua hoa theo cách mới</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className={`card group p-6 transition hover:border-blue-500/40 ${f.span ?? ''}`}>
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-[#7fb2ff] transition group-hover:shadow-glow">
                <f.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── QUY TRÌNH ───────── */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-2">
        <Flow title="Dành cho người mua" tag="Khách hàng" steps={STEPS_CUSTOMER} tone="blue" />
        <Flow title="Dành cho shop hoa" tag="Đối tác" steps={STEPS_SHOP} tone="green">
          <Link href="/dang-nhap?role=shop" className="btn-outline mt-8">
            Đăng ký tài khoản shop
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Flow>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <div className="card-glow relative overflow-hidden bg-gradient-to-br from-[#2f6bff]/25 via-surface to-[#22d39a]/15 px-6 py-12 text-center sm:px-12">
          <Sparkles className="mx-auto h-7 w-7 text-[#7fb2ff]" strokeWidth={1.6} aria-hidden />
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold sm:text-4xl">Bó hoa trong đầu bạn, chỉ cách vài cú kéo thả</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">Thiết kế miễn phí, không cần đăng nhập. Lưu mẫu lại và đăng lên Chợ hoa khi sẵn sàng.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/thiet-ke" className="btn-primary !px-6 !py-3">
              Bắt đầu thiết kế
            </Link>
            <Link href="/cho-hoa" className="btn-accent !px-6 !py-3">
              Xem Chợ hoa
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Flow({
  title,
  tag,
  steps,
  tone,
  children,
}: {
  title: string;
  tag: string;
  steps: Step[];
  tone: 'blue' | 'green';
  children?: React.ReactNode;
}) {
  const accent =
    tone === 'blue'
      ? 'border-blue-500/30 bg-blue-500/10 text-[#7fb2ff]'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  return (
    <div className="card flex flex-col p-6 sm:p-8">
      <span className={tone === 'blue' ? 'chip self-start' : 'chip-green self-start'}>{tag}</span>
      <h2 className="mt-3 text-2xl font-bold">{title}</h2>
      <ol className="relative mt-6 space-y-6">
        <span className="absolute bottom-5 left-5 top-5 w-px bg-gradient-to-b from-white/15 to-transparent" aria-hidden />
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-4">
            <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-[#0b1324] ${accent}`}>
              <s.icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="flex items-center gap-2 font-semibold text-white">
                <span className="text-xs font-medium tabular-nums text-slate-400">0{i + 1}</span>
                {s.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {children && <div className="mt-auto">{children}</div>}
    </div>
  );
}
