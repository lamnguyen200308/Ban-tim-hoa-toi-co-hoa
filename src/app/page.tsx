import Link from 'next/link';

const STEPS_CUSTOMER = [
  { icon: '🎨', title: 'Tự thiết kế', text: 'Chọn hoa, giấy gói, kiểu gói và ruy băng. Xoay bó hoa 3D để ngắm mọi góc.' },
  { icon: '📝', title: 'Đăng yêu cầu', text: 'Đăng thiết kế hoặc ảnh mẫu kèm mô tả, ngân sách và ngày cần hoa.' },
  { icon: '💸', title: 'Chọn giá tốt nhất', text: 'Các shop ẩn danh gửi báo giá cạnh tranh. Chấp nhận rồi quét QR để mở liên hệ shop.' },
];

const STEPS_SHOP = [
  { icon: '🔎', title: 'Xem yêu cầu', text: 'Danh sách khách đang tìm hoa trong khu vực của bạn, cập nhật liên tục.' },
  { icon: '🏷️', title: 'Báo giá', text: 'Gửi giá và lời nhắn. Có thể hạ giá khi thấy đối thủ báo thấp hơn.' },
  { icon: '🤝', title: 'Chốt đơn', text: 'Được chấp nhận → quét QR thanh toán để mở thông tin liên hệ của khách.' },
];

export default function HomePage() {
  return (
    <div>
      <div className="bg-[var(--ink)] text-white">
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
        <div>
          <span className="chip-green">Sàn hoa tươi minh bạch giá</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            Bạn tìm hoa,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">tôi có hoa.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            Quá nhiều shop hoa, không biết mua ở đâu rẻ và đẹp? Tự thiết kế bó hoa trong không gian 3D, xem giá ngay
            lập tức — rồi để các shop hoa cạnh tranh báo giá cho bạn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/thiet-ke" className="btn-primary !px-6 !py-3 text-base">
              🎨 Thiết kế bó hoa 3D
            </Link>
            <Link href="/cho-hoa" className="btn-accent !px-6 !py-3 text-base">
              🛎️ Vào Chợ hoa
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/30 via-slate-900 to-emerald-500/30 text-[9rem] ring-1 ring-white/10">
            <span aria-hidden>💐</span>
          </div>
          <div className="card absolute -bottom-5 left-4 px-4 py-3 text-sm sm:left-8">
            <p className="text-slate-500">Báo giá thấp nhất</p>
            <p className="text-xl font-extrabold text-blue-700">385.000 ₫</p>
          </div>
          <div className="card absolute -top-4 right-4 px-4 py-3 text-sm sm:right-8">
            <p className="font-semibold text-slate-800">🏪 5 shop đã báo giá</p>
          </div>
        </div>
      </section>
      </div>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold">Dành cho người mua 💝</h2>
          <ol className="mt-4 space-y-4">
            {STEPS_CUSTOMER.map((s) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-xl">{s.icon}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-slate-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-bold">Dành cho shop hoa 🏪</h2>
          <ol className="mt-4 space-y-4">
            {STEPS_SHOP.map((s) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-xl">{s.icon}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-slate-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/dang-nhap?role=shop" className="btn-outline mt-6">
            Đăng ký tài khoản shop
          </Link>
        </div>
      </section>
    </div>
  );
}
