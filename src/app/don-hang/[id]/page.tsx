'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import NotConfigured from '@/components/NotConfigured';
import QuoteBreakdown from '@/components/market/QuoteBreakdown';
import DepositDemo from '@/components/orders/DepositDemo';
import DisputePanel from '@/components/orders/DisputePanel';
import { OrderStatusBadge } from '@/components/orders/OrderBadges';
import ContactUnlock from '@/components/payment/ContactUnlock';
import { DemoBadge } from '@/components/payment/PaymentQR';
import { errMsg, formatDate, formatVnd, timeAgo } from '@/lib/format';
import { ORDER_STATUS, ORDER_STEPS, ROLE_LABEL, orderActions, type OrderAction, type OrderRole } from '@/lib/orders';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { Dispute, FlowerRequest, Order, OrderEvent, OrderStatus } from '@/lib/types';

type Parties = {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  shop_name: string | null;
  shop_phone: string | null;
  delivery_address: string | null;
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, loading: authLoading } = useProfile();
  const [order, setOrder] = useState<Order | null>(null);
  const [req, setReq] = useState<Pick<FlowerRequest, 'id' | 'title' | 'needed_by' | 'needed_time' | 'district' | 'city'> | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [parties, setParties] = useState<Parties | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: o } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (!o) {
      setOrder(null);
      setLoading(false);
      return;
    }
    const ord = o as Order;
    setOrder(ord);
    const [{ data: r }, { data: ev }, { data: d }, { data: s }] = await Promise.all([
      supabase.from('requests').select('id, title, needed_by, needed_time, district, city').eq('id', ord.request_id).maybeSingle(),
      supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
      supabase.from('disputes').select('*').eq('order_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('app_settings').select('payment_demo').maybeSingle(),
    ]);
    setReq((r as typeof req) ?? null);
    setEvents((ev ?? []) as OrderEvent[]);
    setDispute(((d ?? []) as Dispute[])[0] ?? null);
    setDemoEnabled(!!(s as { payment_demo?: boolean } | null)?.payment_demo);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!supabaseConfigured || authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
    const supabase = createClient();
    const ch = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load, user, authLoading]);

  const role: OrderRole | null = !order || !user
    ? null
    : user.id === order.customer_id
      ? 'customer'
      : user.id === order.shop_id
        ? 'shop'
        : profile?.is_admin
          ? 'admin'
          : null;

  useEffect(() => {
    if (role !== 'admin' || !order) return;
    createClient()
      .rpc('admin_order_parties', { p_order_id: order.id })
      .then(({ data }) => setParties(((data as Parties[] | null) ?? [])[0] ?? null));
  }, [role, order]);

  if (!supabaseConfigured) return <NotConfigured />;
  if (loading || authLoading) return <p className="p-10 text-center text-slate-500">Đang tải…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Link href={`/dang-nhap?next=${encodeURIComponent(`/don-hang/${id}`)}`} className="btn-primary">
          Đăng nhập để xem đơn hàng
        </Link>
      </div>
    );
  if (!order || !role)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden>🔒</p>
        <p className="mt-2 text-slate-600">Không tìm thấy đơn hàng, hoặc bạn không có quyền xem đơn này.</p>
        <Link href="/tai-khoan" className="btn-outline mt-4">← Tài khoản</Link>
      </div>
    );

  const act = async (a: OrderAction) => {
    let note: string | null = null;
    if (a.needsNote) {
      note = prompt(`${a.confirm ?? ''}\n\nLý do:`);
      if (note === null) return;
      if (!note.trim()) {
        setError('Vui lòng ghi lý do.');
        return;
      }
    } else if (a.confirm && !confirm(a.confirm)) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc('order_transition', { p_order_id: order.id, p_to: a.to, p_note: note });
    setBusy(false);
    if (error) setError(errMsg(error));
    else load();
  };

  const actions = orderActions(order, role);
  const stepIndex = ORDER_STEPS.indexOf(order.status);
  const offTrack = order.status === 'cancelled' || order.status === 'disputed';
  const isDemo = order.payment_mode === 'demo';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/cho-hoa/${order.request_id}`} className="text-sm text-slate-500 hover:text-blue-700">← Về yêu cầu</Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">{req?.title ?? order.quote.request_title ?? 'Đơn hàng'}</h1>
        {isDemo && <DemoBadge />}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Mã đơn <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span> · Bạn là <b>{ROLE_LABEL[role]}</b> · Tạo{' '}
        {timeAgo(order.created_at)}
      </p>

      {/* Thanh tiến trình */}
      <section className="card mt-5 p-4" aria-label="Tiến trình đơn hàng">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          {offTrack && order.previous_status && (
            <span className="text-xs text-slate-500">(trước đó: {ORDER_STATUS[order.previous_status as OrderStatus]?.label})</span>
          )}
        </div>
        <ol className="mt-4 grid grid-cols-6 gap-1">
          {ORDER_STEPS.map((s, i) => {
            const done = !offTrack && i <= stepIndex;
            return (
              <li key={s} className="text-center">
                <div className={`h-1.5 rounded-full ${done ? 'bg-gradient-to-r from-blue-500 to-emerald-400' : 'bg-slate-200'}`} />
                <p className={`mt-1.5 text-[10px] leading-tight sm:text-xs ${done ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                  <span aria-hidden>{ORDER_STATUS[s].icon}</span>
                  <span className="hidden sm:inline"> {ORDER_STATUS[s].label}</span>
                </p>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-slate-600 sm:hidden">Bước hiện tại: {ORDER_STATUS[order.status].label}</p>

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.to}
                type="button"
                disabled={busy}
                onClick={() => act(a)}
                className={a.style === 'primary' ? 'btn-primary' : a.style === 'accent' ? 'btn-accent' : 'btn-outline'}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="text-lg font-bold">Báo giá đã chốt</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nội dung được lưu nguyên lúc khách chấp nhận{order.quote.accepted_at ? ` (${formatDate(order.quote.accepted_at)})` : ''} — dùng làm căn cứ khi có
              tranh chấp.
            </p>
            <div className="mt-3">
              <QuoteBreakdown bid={order.quote} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-blue-50/60 p-3">
                <dt className="text-xs text-slate-500">Cần giao</dt>
                <dd className="font-semibold">
                  {formatDate(req?.needed_by)}
                  {req?.needed_time && ` · ${req.needed_time}`}
                </dd>
              </div>
              <div className="rounded-xl bg-blue-50/60 p-3">
                <dt className="text-xs text-slate-500">Khu vực</dt>
                <dd className="font-semibold">{[req?.district, req?.city].filter(Boolean).join(', ') || '—'}</dd>
              </div>
            </dl>
          </section>

          <DisputePanel order={order} role={role} userId={user.id} dispute={dispute} onChange={load} />

          <section className="card p-5">
            <h2 className="text-lg font-bold">Lịch sử đơn hàng</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-blue-100 pl-4">
              {events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden />
                  <p className="font-semibold text-slate-700">
                    {e.kind === 'payment'
                      ? '💳 Thanh toán'
                      : e.to_status
                        ? `${ORDER_STATUS[e.to_status as OrderStatus]?.icon ?? ''} ${ORDER_STATUS[e.to_status as OrderStatus]?.label ?? e.to_status}`
                        : 'Cập nhật'}
                    <span className="font-normal text-slate-500"> · {ROLE_LABEL[e.actor_role]} · {timeAgo(e.created_at)}</span>
                  </p>
                  {e.note && <p className="whitespace-pre-line text-slate-600">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <DepositDemo order={order} role={role} demoEnabled={demoEnabled} onChange={load} />

          {order.fee_recorded_at && (
            <p className="card p-4 text-sm text-slate-600">
              Phí dịch vụ nền tảng ghi nhận khi hoàn tất: <b>{formatVnd(order.service_fee)}</b>
              {isDemo && ' (số liệu MÔ PHỎNG, không thu tiền thật)'}
            </p>
          )}

          {(role === 'customer' || role === 'shop') && (
            <section className="card p-5">
              <h2 className="text-lg font-bold">Liên hệ {role === 'customer' ? 'shop' : 'khách hàng'}</h2>
              <ContactUnlock requestId={order.request_id} viewerRole={role} />
            </section>
          )}

          {role === 'admin' && parties && (
            <section className="card space-y-1 p-5 text-sm">
              <h2 className="text-lg font-bold">Thông tin hai bên (admin)</h2>
              <p>👤 {parties.customer_name ?? '—'} · {parties.customer_phone ?? '—'} · {parties.customer_email ?? '—'}</p>
              <p>🏪 {parties.shop_name ?? '—'} · {parties.shop_phone ?? '—'}</p>
              <p>🏠 {parties.delivery_address ?? 'Chưa có địa chỉ'}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
