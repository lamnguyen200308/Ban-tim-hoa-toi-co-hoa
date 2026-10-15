'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import NotConfigured from '@/components/NotConfigured';
import { BidStatusBadge, RequestStatusBadge } from '@/components/market/StatusBadge';
import MyOrders from '@/components/orders/MyOrders';
import { errMsg, formatVnd, timeAgo } from '@/lib/format';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { Bid, BouquetDesign, RequestSummary, Shop } from '@/lib/types';

type MyBid = Bid & { request: { id: string; title: string; status: RequestSummary['status'] } | null };

export default function AccountPage() {
  const router = useRouter();
  const { user, profile, loading } = useProfile();
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [designs, setDesigns] = useState<BouquetDesign[]>([]);
  const [bids, setBids] = useState<MyBid[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    const supabase = createClient();
    if (profile.role === 'shop') {
      // Bảng shops đã ẩn tên/SĐT/địa chỉ với mọi người — chủ shop đọc đầy đủ qua hàm get_my_shop
      supabase.rpc('get_my_shop').then(({ data }) => setShop(((data as Shop[] | null) ?? [])[0] ?? null));
      supabase
        .from('bids')
        .select('*, request:requests!bids_request_id_fkey(id, title, status)')
        .eq('shop_id', user.id)
        .order('updated_at', { ascending: false })
        .then(({ data }) => setBids((data ?? []) as MyBid[]));
    } else {
      supabase
        .from('request_summaries')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setRequests((data ?? []) as RequestSummary[]));
      supabase
        .from('bouquet_designs')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setDesigns((data ?? []) as BouquetDesign[]));
    }
  }, [user, profile]);

  if (!supabaseConfigured) return <NotConfigured />;
  if (loading) return <p className="p-10 text-center text-slate-500">Đang tải…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Link href="/dang-nhap?next=/tai-khoan" className="btn-primary">Đăng nhập</Link>
      </div>
    );

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  };

  const saveShop = async (e: FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setSaved(null);
    const { error } = await createClient()
      .from('shops')
      .update({ name: shop.name, address: shop.address, district: shop.district, city: shop.city, phone: shop.phone, description: shop.description })
      .eq('id', shop.id);
    setSaved(error ? 'Lỗi: ' + errMsg(error) : 'Đã lưu ✔');
  };

  const field = (k: keyof Shop, label: string, placeholder = '') => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input
        id={k}
        className="input"
        placeholder={placeholder}
        value={(shop?.[k] as string | null) ?? ''}
        onChange={(e) => setShop((s) => (s ? { ...s, [k]: e.target.value } : s))}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">
            {profile?.role === 'shop' ? '🏪' : '👤'} {profile?.display_name || user.email}
          </h1>
          <p className="text-sm text-slate-500">{profile?.role === 'shop' ? 'Tài khoản shop hoa' : 'Tài khoản người mua'} · {user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.is_admin && (
            <Link href="/quan-tri" className="btn-dark">🛠️ Trang quản trị</Link>
          )}
          <button type="button" className="btn-outline" onClick={logout}>Đăng xuất</button>
        </div>
      </div>

      {profile?.role === 'shop' ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <MyOrders userId={user.id} role="shop" />
          <form onSubmit={saveShop} className="card space-y-3 p-6">
            <h2 className="text-lg font-bold">Thông tin shop</h2>
            <p className="text-xs text-slate-500">
              🔒 Khách hàng chỉ thấy quận/huyện và điểm đánh giá. Tên, số điện thoại, địa chỉ chỉ hiện khi khách đã chọn shop
              bạn, cọc đã được xác nhận và bạn đã trả phí nền tảng (hiện là mô phỏng).
            </p>
            {shop ? (
              <>
                {field('name', 'Tên shop')}
                {field('phone', 'Số điện thoại')}
                {field('address', 'Địa chỉ')}
                <div className="grid grid-cols-2 gap-3">
                  {field('district', 'Quận / huyện')}
                  {field('city', 'Tỉnh / thành phố')}
                </div>
                <div>
                  <label className="label" htmlFor="desc">Giới thiệu</label>
                  <textarea
                    id="desc"
                    className="input min-h-[80px]"
                    value={shop.description ?? ''}
                    onChange={(e) => setShop((s) => (s ? { ...s, description: e.target.value } : s))}
                  />
                </div>
                <button type="submit" className="btn-primary">Lưu</button>
                {saved && <p className="text-sm text-slate-600">{saved}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-500">Đang tải…</p>
            )}
          </form>

          <div className="card p-6">
            <h2 className="text-lg font-bold">Báo giá của tôi</h2>
            {bids.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Chưa có báo giá nào. <Link href="/cho-hoa" className="text-blue-700 underline">Vào Chợ hoa</Link>
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-blue-50">
                {bids.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/cho-hoa/${b.request_id}`} className="block truncate font-semibold hover:text-blue-700">
                        {b.request?.title ?? 'Yêu cầu'}
                      </Link>
                      <p className="text-xs text-slate-500">{timeAgo(b.updated_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-blue-700">{formatVnd(b.price)}</p>
                      <BidStatusBadge status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <MyOrders userId={user.id} role="customer" />
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Yêu cầu của tôi</h2>
              <Link href="/cho-hoa/dang-yeu-cau" className="text-sm font-semibold text-blue-700">+ Đăng mới</Link>
            </div>
            {requests.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Bạn chưa đăng yêu cầu nào.</p>
            ) : (
              <ul className="mt-3 divide-y divide-blue-50">
                {requests.map((r) => (
                  <li key={r.id} className="py-3">
                    <Link href={`/cho-hoa/${r.id}`} className="font-semibold hover:text-blue-700">{r.title}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <RequestStatusBadge status={r.status} />
                      <span>{r.bid_count} báo giá</span>
                      {r.lowest_bid && <span className="font-semibold text-blue-700">thấp nhất {formatVnd(r.lowest_bid)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Thiết kế đã lưu</h2>
              <Link href="/thiet-ke" className="text-sm font-semibold text-blue-700">+ Thiết kế mới</Link>
            </div>
            {designs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Chưa có thiết kế nào.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3">
                {designs.map((d) => (
                  <li key={d.id} className="rounded-xl border border-blue-100 p-2">
                    {d.snapshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.snapshot_url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    ) : (
                      <div className="grid aspect-square place-items-center rounded-lg bg-blue-50 text-4xl" aria-hidden>💐</div>
                    )}
                    <p className="mt-2 truncate text-sm font-semibold">{d.name}</p>
                    <p className="text-xs text-slate-500">{formatVnd(d.total_price)}</p>
                    <Link href={`/cho-hoa/dang-yeu-cau?design=${d.id}`} className="mt-1 block text-xs font-semibold text-blue-700">
                      Đăng lên Chợ hoa →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
