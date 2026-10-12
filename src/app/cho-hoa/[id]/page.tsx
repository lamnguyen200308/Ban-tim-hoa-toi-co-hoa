'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import NotConfigured from '@/components/NotConfigured';
import BidForm from '@/components/market/BidForm';
import DesignCard from '@/components/market/DesignCard';
import { BidStatusBadge, RequestStatusBadge } from '@/components/market/StatusBadge';
import { budgetText, errMsg, formatDate, formatVnd, timeAgo } from '@/lib/format';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { Bid, BouquetDesign, FlowerRequest, Profile } from '@/lib/types';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useProfile();
  const [req, setReq] = useState<FlowerRequest | null>(null);
  const [design, setDesign] = useState<BouquetDesign | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: r, error: rErr } = await supabase.from('requests').select('*').eq('id', id).maybeSingle();
    if (rErr || !r) {
      setError('Không tìm thấy yêu cầu này.');
      setLoading(false);
      return;
    }
    const request = r as FlowerRequest;
    setReq(request);

    const [{ data: b }, d, c] = await Promise.all([
      supabase
        .from('bids')
        .select('*, shop:shops(id, name, district, city, phone, address, rating)')
        .eq('request_id', id)
        .order('price', { ascending: true }),
      request.design_id
        ? supabase.from('bouquet_designs').select('*').eq('id', request.design_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // RLS chỉ trả về khi bạn là chủ yêu cầu, hoặc là shop đã được chấp nhận
      supabase.from('profiles').select('id, role, display_name, phone').eq('id', request.customer_id).maybeSingle(),
    ]);
    setBids((b ?? []) as Bid[]);
    setDesign((d.data as BouquetDesign | null) ?? null);
    setCustomer((c.data as Profile | null) ?? null);
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
  if (loading) return <p className="p-10 text-center text-stone-500">Đang tải…</p>;
  if (error || !req)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-stone-600">{error}</p>
        <Link href="/cho-hoa" className="btn-outline mt-4">← Về Chợ hoa</Link>
      </div>
    );

  const isOwner = !!user && user.id === req.customer_id;
  const isShop = profile?.role === 'shop';
  const visibleBids = bids.filter((b) => b.status !== 'withdrawn');
  const activeBids = bids.filter((b) => b.status === 'pending' || b.status === 'accepted');
  const lowest = activeBids.length ? Math.min(...activeBids.map((b) => b.price)) : null;
  const myBid = bids.find((b) => b.shop_id === user?.id) ?? null;

  const rpc = async (fn: 'accept_bid' | 'reject_bid', bidId: string) => {
    if (fn === 'accept_bid' && !confirm('Chấp nhận báo giá này? Các báo giá còn lại sẽ tự động bị từ chối.')) return;
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
      <Link href="/cho-hoa" className="text-sm text-stone-500 hover:text-rose-700">← Chợ hoa</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Thông tin yêu cầu */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            {req.image_urls.length > 0 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={req.image_urls[activeImg] ?? req.image_urls[0]} alt="Ảnh mẫu" className="aspect-[4/3] w-full bg-rose-50 object-contain" />
                {req.image_urls.length > 1 && (
                  <div className="flex gap-2 p-3">
                    {req.image_urls.map((u, i) => (
                      <button key={u} type="button" onClick={() => setActiveImg(i)} className={`rounded-lg ring-2 ${i === activeImg ? 'ring-rose-500' : 'ring-transparent'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-rose-50 text-8xl" aria-hidden>💐</div>
            )}
          </div>

          <div className="card space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <RequestStatusBadge status={req.status} />
              <span className="text-xs text-stone-500">Đăng {timeAgo(req.created_at)}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-stone-800">{req.title}</h1>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-rose-50/60 p-3">
                <dt className="text-xs text-stone-500">Ngân sách</dt>
                <dd className="font-semibold">{budgetText(req.budget_min, req.budget_max)}</dd>
              </div>
              <div className="rounded-xl bg-rose-50/60 p-3">
                <dt className="text-xs text-stone-500">Cần ngày</dt>
                <dd className="font-semibold">{formatDate(req.needed_by)}</dd>
              </div>
              <div className="rounded-xl bg-rose-50/60 p-3">
                <dt className="text-xs text-stone-500">Khu vực</dt>
                <dd className="font-semibold">{[req.district, req.city].filter(Boolean).join(', ') || '—'}</dd>
              </div>
            </dl>
            <p className="whitespace-pre-line text-stone-700">{req.description}</p>
            {design && <DesignCard design={design} />}
            {isOwner && req.status === 'open' && (
              <button type="button" onClick={closeRequest} className="text-sm text-stone-500 underline hover:text-rose-700">
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
              {lowest !== null && <span className="text-sm">Thấp nhất <b className="text-rose-700">{formatVnd(lowest)}</b></span>}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Cập nhật trực tiếp
            </p>

            {visibleBids.length === 0 ? (
              <p className="mt-4 rounded-xl bg-rose-50 p-4 text-center text-sm text-stone-600">Chưa có shop nào báo giá. Hãy quay lại sau ít phút nhé!</p>
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
                            ? 'border-rose-300 bg-rose-50/50'
                            : b.status === 'rejected'
                              ? 'border-stone-200 bg-stone-50 opacity-70'
                              : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            🏪 {b.shop?.name ?? 'Shop hoa'} {b.shop_id === user?.id && <span className="chip ml-1">Bạn</span>}
                          </p>
                          <p className="text-xs text-stone-500">
                            📍 {b.shop?.district ?? '—'} · {timeAgo(b.updated_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-extrabold tabular-nums text-rose-700">{formatVnd(b.price)}</p>
                          {best && <span className="chip">Giá tốt nhất</span>}
                        </div>
                      </div>
                      {b.message && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{b.message}</p>}
                      {b.delivery_note && <p className="mt-1 text-xs text-stone-500">🚚 {b.delivery_note}</p>}
                      <div className="mt-2">
                        <BidStatusBadge status={b.status} />
                      </div>

                      {isOwner && req.status === 'open' && b.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <button type="button" disabled={busyId === b.id} className="btn-primary !px-4 !py-1.5 text-xs" onClick={() => rpc('accept_bid', b.id)}>
                            ✅ Chấp nhận
                          </button>
                          <button type="button" disabled={busyId === b.id} className="btn-outline !px-4 !py-1.5 text-xs" onClick={() => rpc('reject_bid', b.id)}>
                            Từ chối
                          </button>
                        </div>
                      )}

                      {b.status === 'accepted' && isOwner && (
                        <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-emerald-200">
                          <p className="font-semibold">Liên hệ shop</p>
                          <p>📞 {b.shop?.phone || 'Shop chưa cập nhật số điện thoại'}</p>
                          {b.shop?.address && <p>🏠 {b.shop.address}</p>}
                        </div>
                      )}
                      {b.status === 'accepted' && b.shop_id === user?.id && customer && (
                        <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-emerald-200">
                          <p className="font-semibold">🎉 Bạn đã thắng! Liên hệ khách</p>
                          <p>👤 {customer.display_name || 'Khách hàng'}</p>
                          <p>📞 {customer.phone || 'Khách chưa cập nhật số điện thoại'}</p>
                        </div>
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
                <p className="text-sm text-stone-600">Chỉ tài khoản shop hoa mới gửi được báo giá.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
