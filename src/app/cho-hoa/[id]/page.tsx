'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import NotConfigured from '@/components/NotConfigured';
import BidForm from '@/components/market/BidForm';
import ContactUnlock from '@/components/payment/ContactUnlock';
import DesignCard from '@/components/market/DesignCard';
import QuoteBreakdown, { isExpired } from '@/components/market/QuoteBreakdown';
import { BidStatusBadge, RequestStatusBadge } from '@/components/market/StatusBadge';
import { anonShopLabel } from '@/lib/contact';
import { budgetText, errMsg, formatDate, formatVnd, timeAgo } from '@/lib/format';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { Bid, BouquetDesign, FlowerRequest } from '@/lib/types';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useProfile();
  const [req, setReq] = useState<FlowerRequest | null>(null);
  const [design, setDesign] = useState<BouquetDesign | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: r, error: rErr } = await supabase.from('requests').select('*').eq('id', id).maybeSingle();
    if (rErr || !r) {
      setError('Không tìm thấy yêu cầu này, hoặc bạn đã xem hết số đơn được phép.');
      setLoading(false);
      return;
    }
    const request = r as FlowerRequest;
    setReq(request);

    const [{ data: b }, d] = await Promise.all([
      supabase
        .from('bids')
        .select('*, shop:shops(id, district, city, rating)')
        .eq('request_id', id)
        .order('price', { ascending: true }),
      request.design_id
        ? supabase.from('bouquet_designs').select('*').eq('id', request.design_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setBids((b ?? []) as Bid[]);
    setDesign((d.data as BouquetDesign | null) ?? null);
    // Đơn hàng (chỉ khách, shop thắng, admin đọc được) & địa chỉ giao (chỉ chủ yêu cầu, admin)
    const [{ data: o }, { data: rp }] = await Promise.all([
      supabase.from('orders').select('id').eq('request_id', id).maybeSingle(),
      supabase.from('request_private').select('delivery_address').eq('request_id', id).maybeSingle(),
    ]);
    setOrderId((o as { id: string } | null)?.id ?? null);
    setAddress((rp as { delivery_address: string | null } | null)?.delivery_address ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`request-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids', filter: `request_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load, user?.id]);

  if (!supabaseConfigured) return <NotConfigured />;
  if (loading) return <p className="p-10 text-center text-slate-500">Đang tải…</p>;
  if (error || !req)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden>🔒</p>
        <p className="mt-2 text-slate-600">{error}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/cho-hoa" className="btn-outline">← Về Chợ hoa</Link>
          {!user && (
            <Link href={`/dang-nhap?next=${encodeURIComponent(`/cho-hoa/${id}`)}`} className="btn-primary">
              Đăng nhập để xem thêm 10 đơn
            </Link>
          )}
        </div>
      </div>
    );

  const isOwner = !!user && user.id === req.customer_id;
  const isShop = profile?.role === 'shop';
  const visibleBids = bids.filter((b) => b.status !== 'withdrawn');
  const activeBids = bids.filter((b) => b.status === 'pending' || b.status === 'accepted');
  const lowest = activeBids.length ? Math.min(...activeBids.map((b) => b.price)) : null;
  const myBid = bids.find((b) => b.shop_id === user?.id) ?? null;
  // Tên ẩn danh theo thứ tự gửi báo giá — tên thật chỉ hiện sau khi thanh toán
  const aliases = new Map(
    [...bids].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((b, i) => [b.id, anonShopLabel(i)]),
  );

  const rpc = async (fn: 'accept_bid' | 'reject_bid', bidId: string) => {
    if (
      fn === 'accept_bid' &&
      !confirm(
        'Chấp nhận báo giá này? Hệ thống tạo đơn hàng và lưu lại nguyên nội dung báo giá. Các báo giá còn lại tự động bị từ chối.',
      )
    )
      return;
    setBusyId(bidId);
    const { error } = await createClient().rpc(fn, { p_bid_id: bidId });
    setBusyId(null);
    if (error) alert(errMsg(error));
    else load();
  };

  const closeRequest = async () => {
    if (!confirm('Đóng yêu cầu này? Các shop sẽ không thể báo giá nữa.')) return;
    const { error } = await createClient().from('requests').update({ status: 'closed' }).eq('id', req.id);
    if (error) alert(errMsg(error));
    else load();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/cho-hoa" className="text-sm text-slate-500 hover:text-blue-700">← Chợ hoa</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Thông tin yêu cầu */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            {req.image_urls.length > 0 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={req.image_urls[activeImg] ?? req.image_urls[0]} alt="Ảnh mẫu" className="aspect-[4/3] w-full bg-blue-50 object-contain" />
                {req.image_urls.length > 1 && (
                  <div className="flex gap-2 p-3">
                    {req.image_urls.map((u, i) => (
                      <button key={u} type="button" onClick={() => setActiveImg(i)} className={`rounded-lg ring-2 ${i === activeImg ? 'ring-blue-500' : 'ring-transparent'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-blue-50 text-8xl" aria-hidden>💐</div>
            )}
          </div>

          <div className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <RequestStatusBadge status={req.status} />
              <span className="text-xs text-slate-500">Đăng {timeAgo(req.created_at)}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800">{req.title}</h1>
            {(req.occasion || req.size_note) && (
              <div className="flex flex-wrap gap-2">
                {req.occasion && <span className="chip">🎁 {req.occasion}</span>}
                {req.size_note && <span className="chip-green">📏 {req.size_note}</span>}
              </div>
            )}
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-blue-50/60 p-3">
                <dt className="text-xs text-slate-500">Ngân sách</dt>
                <dd className="font-semibold">{budgetText(req.budget_min, req.budget_max)}</dd>
              </div>
              <div className="rounded-xl bg-blue-50/60 p-3">
                <dt className="text-xs text-slate-500">Cần ngày</dt>
                <dd className="font-semibold">
                  {formatDate(req.needed_by)}
                  {req.needed_time && <span className="font-normal text-slate-600"> · {req.needed_time}</span>}
                </dd>
              </div>
              <div className="rounded-xl bg-blue-50/60 p-3">
                <dt className="text-xs text-slate-500">Khu vực</dt>
                <dd className="font-semibold">{[req.district, req.city].filter(Boolean).join(', ') || '—'}</dd>
              </div>
            </dl>
            <p className="whitespace-pre-line text-slate-700">{req.description}</p>
            {req.card_message && (
              <p className="rounded-xl bg-emerald-50/70 p-3 text-sm text-slate-700">
                💌 <span className="text-slate-500">Lời nhắn / yêu cầu đặc biệt:</span> {req.card_message}
              </p>
            )}
            {address && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm">
                🏠 <span className="text-slate-500">Địa chỉ giao (chỉ bạn thấy):</span> {address}
              </p>
            )}
            {design && <DesignCard design={design} />}
            {isOwner && req.status === 'open' && (
              <button type="button" onClick={closeRequest} className="text-sm text-slate-500 underline hover:text-blue-700">
                Đóng yêu cầu
              </button>
            )}
          </div>
        </div>

        {/* Báo giá */}
        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Báo giá ({activeBids.length})</h2>
              {lowest !== null && <span className="text-sm">Thấp nhất <b className="text-blue-700">{formatVnd(lowest)}</b></span>}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Cập nhật trực tiếp
            </p>

            {visibleBids.length === 0 ? (
              <p className="mt-4 rounded-xl bg-blue-50 p-4 text-center text-sm text-slate-600">Chưa có shop nào báo giá. Hãy quay lại sau ít phút nhé!</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {visibleBids.map((b) => {
                  const best = b.status === 'pending' && b.price === lowest;
                  return (
                    <li
                      key={b.id}
                      className={`rounded-xl border p-3 ${
                        b.status === 'accepted'
                          ? 'border-emerald-300 bg-emerald-50'
                          : best
                            ? 'border-blue-300 bg-blue-50/50'
                            : b.status === 'rejected'
                              ? 'border-slate-200 bg-slate-50 opacity-70'
                              : 'border-slate-200 bg-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            🏪 {aliases.get(b.id)} {b.shop_id === user?.id && <span className="chip ml-1">Bạn</span>}
                          </p>
                          <p className="text-xs text-slate-500">
                            📍 {b.shop?.district ?? '—'}
                            {b.shop?.rating ? ` · ⭐ ${b.shop.rating}` : ''} · {timeAgo(b.updated_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-extrabold tabular-nums text-blue-700">{formatVnd(b.price)}</p>
                          {best && <span className="chip">Giá tốt nhất</span>}
                        </div>
                      </div>
                      <div className="mt-2">
                        <QuoteBreakdown bid={b} />
                      </div>
                      <div className="mt-2">
                        <BidStatusBadge status={b.status} />
                      </div>

                      {isOwner && req.status === 'open' && b.status === 'pending' && isExpired(b) && (
                        <p className="mt-2 text-xs text-slate-500">Báo giá đã hết hạn — chờ shop cập nhật lại để chấp nhận.</p>
                      )}
                      {isOwner && req.status === 'open' && b.status === 'pending' && !isExpired(b) && (
                        <div className="mt-3 flex gap-2">
                          <button type="button" disabled={busyId === b.id} className="btn-primary !px-4 !py-1.5 text-xs" onClick={() => rpc('accept_bid', b.id)}>
                            ✅ Chấp nhận
                          </button>
                          <button type="button" disabled={busyId === b.id} className="btn-outline !px-4 !py-1.5 text-xs" onClick={() => rpc('reject_bid', b.id)}>
                            Từ chối
                          </button>
                        </div>
                      )}

                      {b.status === 'accepted' && orderId && (
                        <Link href={`/don-hang/${orderId}`} className="btn-primary mt-3 w-full">
                          📋 Xem đơn hàng & đặt cọc (demo)
                        </Link>
                      )}
                      {b.status === 'accepted' && isOwner && <ContactUnlock requestId={req.id} viewerRole="customer" />}
                      {b.status === 'accepted' && b.shop_id === user?.id && (
                        <>
                          <p className="mt-3 font-semibold text-emerald-700">🎉 Bạn đã thắng đơn này!</p>
                          <ContactUnlock requestId={req.id} viewerRole="shop" />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {req.status === 'open' && !isOwner && (
            <div className="card p-5">
              {!user ? (
                <div className="text-center text-sm">
                  <p>Bạn là shop hoa và muốn báo giá?</p>
                  <Link href={`/dang-nhap?role=shop&next=${encodeURIComponent(`/cho-hoa/${req.id}`)}`} className="btn-primary mt-3">
                    Đăng nhập tài khoản shop
                  </Link>
                </div>
              ) : isShop ? (
                <BidForm requestId={req.id} shopId={user.id} myBid={myBid} lowest={lowest} onDone={load} />
              ) : (
                <p className="text-sm text-slate-600">Chỉ tài khoản shop hoa mới gửi được báo giá.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
