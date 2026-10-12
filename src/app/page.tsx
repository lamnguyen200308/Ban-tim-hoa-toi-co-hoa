import Link from 'next/link';

const STEPS_CUSTOMER = [
  { icon: '🎨', title: 'Tự thiết kế', text: 'Chọn hoa, giấy gói, kiểu gói và ruy băng. Xoay bó hoa 3D để ngắm mọi góc.' },
  { icon: '📝', title: 'Đăng yêu cầu', text: 'Đăng thiết kế hoặc ảnh mẫu kèm mô tả, ngân sách và ngày cần hoa.' },
  { icon: '💸', title: 'Chọn giá tốt nhất', text: 'Các shop gửi báo giá cạnh tranh. Bạn chấp nhận shop ưng ý nhất.' },
];

const STEPS_SHOP = [
  { icon: '🔎', title: 'Xem yêu cầu', text: 'Danh sách khách đang tìm hoa trong khu vực của bạn, cập nhật liên tục.' },
  { icon: '🏷️', title: 'Báo giá', text: 'Gửi giá và lời nhắn. Có thể hạ giá khi thấy đối thủ báo thấp hơn.' },
  { icon: '🤝', title: 'Chốt đơn', text: 'Được chấp nhận là thấy ngay thông tin liên hệ của khách.' },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4">
      <section className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
        <div>
          <span className="chip">Sàn hoa tươi minh bạch giá</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-stone-800 sm:text-5xl">
            Bạn tìm hoa,
            <br />
            <span className="text-rose-600">tôi có hoa.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-stone-600">
            Quá nhiều shop hoa, không biết mua ở đâu rẻ và đẹp? Tự thiết kế bó hoa trong không gian 3D, xem giá ngay
            lập tức — rồi để các shop hoa cạnh tranh báo giá cho bạn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/thiet-ke" className="btn-primary !px-6 !py-3 text-base">
              🎨 Thiết kế bó hoa 3D
            </Link>
            <Link href="/cho-hoa" className="btn-outline !px-6 !py-3 text-base">
              🛎️ Vào Chợ hoa
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="card grid aspect-square place-items-center overflow-hidden bg-gradient-to-br from-rose-50 via-white to-amber-50 text-[9rem]">
            <span aria-hidden>💐</span>
          </div>
          <div className="card absolute -bottom-5 left-4 px-4 py-3 text-sm sm:left-8">
            <p className="text-stone-500">Báo giá thấp nhất</p>
            <p className="text-xl font-extrabold text-rose-700">385.000 ₫</p>
          </div>
          <div className="card absolute -top-4 right-4 px-4 py-3 text-sm sm:right-8">
            <p className="font-semibold">🏪 5 shop đã báo giá</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-10 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold">Dành cho người mua 💝</h2>
          <ol className="mt-4 space-y-4">
            {STEPS_CUSTOMER.map((s) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-xl">{s.icon}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-stone-600">{s.text}</p>
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
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-xl">{s.icon}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-stone-600">{s.text}</p>
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
