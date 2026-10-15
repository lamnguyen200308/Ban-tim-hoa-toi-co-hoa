'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import NotConfigured from '@/components/NotConfigured';
import { BidStatusBadge, RequestStatusBadge } from '@/components/market/StatusBadge';
import { OrderStatusBadge, PaymentBadge } from '@/components/orders/OrderBadges';
import { DemoBadge, DemoNotice } from '@/components/payment/PaymentQR';
import { errMsg, formatVnd, timeAgo } from '@/lib/format';
import { DEPOSIT_STATUS, FEE_STATUS, ORDER_STATUS } from '@/lib/orders';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { AppSettings, Bid, DepositStatus, OrderStatus, PaymentStatus, PlatformFeeStatus, RequestSummary } from '@/lib/types';

/*
 * Trang quản trị cho chủ website. Mọi dữ liệu lấy qua hàm admin_* trong database,
 * các hàm này tự kiểm tra is_admin — ẩn trang này đi cũng không phải lớp bảo vệ duy nhất.
 */

type Overview = {
  customers: number;
  shops: number;
  requests_open: number;
  requests_total: number;
  bids_total: number;
  orders_by_status: Partial<Record<OrderStatus, number>>;
  disputes_open: number;
  demo_deposits: number;
  demo_fees: number;
  demo_unlocks: number;
  expected_fees: number;
  real_fees: number;
  real_unlock_revenue: number;
  awaiting_deposit_verification?: number;
  awaiting_platform_fee?: number;
  conditions_overdue?: number;
  contacts_unlocked?: number;
};

type AdminOrder = {
  id: string;
  request_id: string;
  request_title: string;
  customer_name: string | null;
  shop_name: string | null;
  total: number;
  deposit_amount: number;
  payment_mode: 'demo' | 'live';
  payment_status: PaymentStatus;
  status: OrderStatus;
  service_fee: number;
  deposit_note: string | null;
  open_dispute: string | null;
  updated_at: string;
  deposit_status?: DepositStatus;
  platform_fee_amount?: number | null;
  platform_fee_status?: PlatformFeeStatus;
  contact_unlocked_at?: string | null;
  evidence_count?: number;
  needs_attention?: boolean;
};

type AdminUser = {
  id: string;
  email: string | null;
  role: 'customer' | 'shop';
  display_name: string | null;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
  shop_name: string | null;
  shop_district: string | null;
};

type AuditRow = { id: number; action: string; target: string | null; details: Record<string, unknown>; created_at: string };

const TABS = [
  ['overview', '📊 Tổng quan'],
  ['verify', '🔎 Chờ xác minh'],
  ['disputes', '⚖️ Khiếu nại'],
  ['orders', '📋 Đơn hàng'],
  ['market', '🛎️ Yêu cầu & báo giá'],
  ['users', '👥 Người dùng'],
  ['settings', '⚙️ Cấu hình'],
  ['log', '🧾 Nhật ký'],
] as const;
type TabKey = (typeof TABS)[number][0];

function Stat({ label, value, hint, tone = 'plain' }: { label: string; value: string | number; hint?: string; tone?: 'plain' | 'demo' | 'real' }) {
  const cls =
    tone === 'demo' ? 'bg-amber-50 ring-amber-200' : tone === 'real' ? 'bg-emerald-50 ring-emerald-200' : 'bg-surface ring-slate-200';
  return (
    <div className={`rounded-2xl p-4 ring-1 ${cls}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-800">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function AdminPage() {
  const { user, profile, loading } = useProfile();
  const [tab, setTab] = useState<TabKey>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [bids, setBids] = useState<(Bid & { request: { title: string } | null })[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [log, setLog] = useState<AuditRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const isAdmin = !!profile?.is_admin;

  const load = useCallback(async () => {
    const supabase = createClient();
    setError(null);
    const [ov, od, us, rq, bd, st, lg] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.rpc('admin_list_orders'),
      supabase.rpc('admin_list_users'),
      supabase.from('request_summaries').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('bids').select('*, request:requests!bids_request_id_fkey(title)').order('updated_at', { ascending: false }).limit(50),
      supabase.from('app_settings').select('*').maybeSingle(),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    const firstErr = [ov, od, us].find((r) => r.error)?.error;
    if (firstErr) setError(errMsg(firstErr));
    setOverview((ov.data as Overview | null) ?? null);
    setOrders((od.data ?? []) as AdminOrder[]);
    setUsers((us.data ?? []) as AdminUser[]);
    setRequests((rq.data ?? []) as RequestSummary[]);
    setBids((bd.data ?? []) as typeof bids);
    setSettings((st.data as AppSettings | null) ?? null);
    setLog((lg.data ?? []) as AuditRow[]);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!supabaseConfigured) return <NotConfigured />;
  if (loading) return <p className="p-10 text-center text-slate-500">Đang tải…</p>;
  if (!user || !isAdmin)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden>🔒</p>
        <p className="mt-2 text-slate-600">Trang này chỉ dành cho quản trị viên.</p>
        {!user && (
          <Link href="/dang-nhap?next=/quan-tri" className="btn-primary mt-4">
            Đăng nhập
          </Link>
        )}
      </div>
    );

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (!settings.payment_demo && !confirm('Tắt chế độ demo? Website CHƯA có cổng thanh toán thật, nên khách sẽ không đặt cọc được cho đơn mới.')) return;
    setSaved(null);
    const { error } = await createClient().rpc('admin_update_settings', {
      p_deposit_percent: settings.deposit_percent,
      p_service_fee: settings.service_fee,
      p_payment_demo: settings.payment_demo,
      p_unlock_fee_customer: settings.unlock_fee_customer,
      p_unlock_fee_shop: settings.unlock_fee_shop,
      p_guest_quota: settings.guest_quota,
      p_member_quota: settings.member_quota,
    });
    let err = error;
    if (!err && settings.condition_review_hours) {
      ({ error: err } = await createClient().rpc('admin_update_review_hours', { p_hours: settings.condition_review_hours }));
    }
    setSaved(err ? 'Lỗi: ' + errMsg(err) : 'Đã lưu ✔ (có ghi vào nhật ký)');
    if (!err) load();
  };

  const withdrawBid = async (id: string) => {
    const note = prompt('Lý do gỡ báo giá này (VD: spam, giá ảo):');
    if (!note) return;
    const { error } = await createClient().rpc('admin_withdraw_bid', { p_bid_id: id, p_note: note });
    if (error) alert(errMsg(error));
    else load();
  };

  const numField = (k: keyof AppSettings, label: string, hint?: string, suffix = '') => (
    <div>
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={k}
          type="number"
          inputMode="numeric"
          min={0}
          max={k === 'deposit_percent' ? 100 : undefined}
          className="input"
          value={String(settings?.[k] ?? '')}
          onChange={(e) => setSettings((s) => (s ? { ...s, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) } : s))}
        />
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  const disputed = orders.filter((o) => o.open_dispute || o.status === 'disputed');
  // Đơn chưa mở liên hệ, còn chạy, đang chờ một trong hai điều kiện — đơn quá hạn xem xét lên đầu
  const awaiting = orders
    .filter(
      (o) =>
        !o.contact_unlocked_at &&
        !['cancelled', 'completed'].includes(o.status) &&
        (o.deposit_status === 'pending_verification' ||
          o.deposit_status === 'disputed' ||
          o.platform_fee_status !== 'verified_demo' ||
          o.needs_attention),
    )
    .sort((a, b) => Number(!!b.needs_attention) - Number(!!a.needs_attention));
  const shownOrders = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-slate-800">Quản trị</h1>
        <button type="button" className="btn-outline" onClick={load}>
          🔄 Tải lại
        </button>
      </div>
      {settings?.payment_demo && (
        <div className="mt-4">
          <DemoNotice>Chế độ demo đang BẬT: mọi khoản cọc, phí, hoàn tiền là số liệu mô phỏng — không phải doanh thu thật.</DemoNotice>
        </div>
      )}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} — đã chạy migration 0003 và 0004 chưa?</p>}

      <nav className="mt-6 flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Mục quản trị">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === k ? 'bg-blue-600 text-white shadow-glow' : 'bg-surface text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
            {k === 'verify' && awaiting.length > 0 && <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 text-xs text-white">{awaiting.length}</span>}
            {k === 'disputes' && disputed.length > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{disputed.length}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'overview' && overview && (
          <div className="space-y-6">
            <section>
              <h2 className="panel-title">Hoạt động</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Khách hàng" value={overview.customers} />
                <Stat label="Shop hoa" value={overview.shops} />
                <Stat label="Yêu cầu đang mở" value={overview.requests_open} hint={`/ ${overview.requests_total} tổng`} />
                <Stat label="Báo giá" value={overview.bids_total} />
                {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
                  <Stat key={s} label={`Đơn: ${ORDER_STATUS[s].label}`} value={overview.orders_by_status[s] ?? 0} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="panel-title">Mở liên hệ (cọc + phí nền tảng)</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Chờ xác minh cọc" value={overview.awaiting_deposit_verification ?? 0} />
                <Stat label="Chờ phí nền tảng" value={overview.awaiting_platform_fee ?? 0} />
                <Stat
                  label="Quá hạn xem xét"
                  value={overview.conditions_overdue ?? 0}
                  hint={`Chờ quá ${settings?.condition_review_hours ?? 48} giờ — chỉ nhắc, không tự xử lý`}
                />
                <Stat label="Đã mở liên hệ" value={overview.contacts_unlocked ?? 0} />
              </div>
            </section>
            <section>
              <h2 className="panel-title flex items-center gap-2">
                Số liệu thử nghiệm <DemoBadge />
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat tone="demo" label="Cọc mô phỏng đã xác nhận" value={formatVnd(overview.demo_deposits)} hint="Tiền của shop — không phải doanh thu Flomal" />
                <Stat tone="demo" label="Phí nền tảng mô phỏng" value={formatVnd(overview.demo_fees)} hint="Không phải doanh thu thật" />
                <Stat tone="demo" label="Lượt mở liên hệ (demo)" value={overview.demo_unlocks} />
                <Stat label="Phí nền tảng chưa thu" value={formatVnd(overview.expected_fees)} hint="Đơn đang chạy — chưa phải doanh thu" />
              </div>
            </section>
            <section>
              <h2 className="panel-title">Doanh thu thật</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat tone="real" label="Phí nền tảng thật" value={formatVnd(overview.real_fees)} hint="Chỉ đơn thật đã đối soát" />
                <Stat tone="real" label="Phí mở thông tin thật (cũ)" value={formatVnd(overview.real_unlock_revenue)} hint="Đã ngừng dùng" />
              </div>
              <p className="mt-2 text-xs text-slate-500">Website chưa nối cổng thanh toán, nên doanh thu thật hiện luôn là 0 ₫.</p>
            </section>
          </div>
        )}

        {tab === 'verify' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Đơn chưa mở liên hệ đang chờ cọc hoặc phí nền tảng. Mở đơn để xem bằng chứng, lịch sử và xác nhận / từ chối (có ghi lý do).
              Hệ thống không tự phạt, khoá hay mở liên hệ khi quá hạn.
            </p>
            <AdminOrderList orders={awaiting} empty="Không có đơn nào đang chờ xác minh. 🎉" />
          </div>
        )}

        {tab === 'disputes' && (
          <AdminOrderList orders={disputed} empty="Không có khiếu nại nào đang xử lý. 🎉" />
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}>
              <option value="">Tất cả trạng thái ({orders.length})</option>
              {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS[s].label}
                </option>
              ))}
            </select>
            <AdminOrderList orders={shownOrders} empty="Chưa có đơn hàng." />
          </div>
        )}

        {tab === 'market' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-lg font-bold">50 yêu cầu mới nhất</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {requests.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <Link href={`/cho-hoa/${r.id}`} className="font-semibold hover:text-blue-700">
                      {r.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <RequestStatusBadge status={r.status} />
                      <span>{r.bid_count} báo giá</span>
                      <span>{timeAgo(r.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="text-lg font-bold">50 báo giá mới nhất</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {bids.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/cho-hoa/${b.request_id}`} className="block truncate font-semibold hover:text-blue-700">
                        {b.request?.title ?? 'Yêu cầu'}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <BidStatusBadge status={b.status} /> {timeAgo(b.updated_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-blue-700">{formatVnd(b.price)}</p>
                      {b.status === 'pending' && (
                        <button type="button" className="text-xs text-red-600 underline" onClick={() => withdrawBid(b.id)}>
                          Gỡ báo giá
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">SĐT</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Tham gia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 font-semibold">
                      {u.role === 'shop' ? `🏪 ${u.shop_name ?? '—'}` : `👤 ${u.display_name ?? '—'}`}
                      {u.shop_district && <span className="block text-xs font-normal text-slate-500">{u.shop_district}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.email}
                      {u.email?.endsWith('@demo.test') && <span className="ml-1 align-middle"><DemoBadge /></span>}
                    </td>
                    <td className="px-4 py-2.5">{u.phone ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {u.role === 'shop' ? 'Shop' : 'Khách'}
                      {u.is_admin && <span className="chip ml-1">Admin</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{timeAgo(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'settings' && settings && (
          <form onSubmit={saveSettings} className="card max-w-2xl space-y-5 p-6">
            <label className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={settings.payment_demo}
                onChange={(e) => setSettings((s) => (s ? { ...s, payment_demo: e.target.checked } : s))}
              />
              <span>
                <span className="font-bold">Chế độ demo thanh toán</span>
                <span className="block text-sm text-slate-600">
                  Bật: hiện QR minh hoạ và nút “Mô phỏng thanh toán thành công”. Tắt: ẩn các nút mô phỏng — nhưng website vẫn CHƯA nhận được tiền
                  thật cho tới khi nối cổng thanh toán.
                </span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {numField('deposit_percent', 'Tỷ lệ đặt cọc', 'Áp dụng cho đơn tạo sau khi lưu.', '%')}
              {numField('service_fee', 'Phí nền tảng / đơn (shop trả)', 'Thu trước khi mở liên hệ. Lưu theo từng đơn lúc khách chốt.', '₫')}
              {numField('condition_review_hours', 'Thời gian xem xét điều kiện', 'Quá hạn chỉ hiện nhắc trong mục Chờ xác minh.', 'giờ')}
              {numField('guest_quota', 'Số đơn xem được khi chưa đăng nhập')}
              {numField('member_quota', 'Số đơn xem được khi đã đăng nhập')}
            </div>
            <p className="text-xs text-slate-500">
              Phí mở thông tin cũ (khách / shop trả riêng) đã ngừng dùng: liên hệ giờ chỉ mở khi đơn đủ cọc + phí nền tảng.
            </p>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              VD: đơn {formatVnd(600000)} với cọc {settings.deposit_percent}% → cọc {formatVnd(Math.round((600000 * settings.deposit_percent) / 100))}.
            </p>
            <button type="submit" className="btn-primary">Lưu cấu hình</button>
            {saved && <p className="text-sm text-slate-600">{saved}</p>}
          </form>
        )}

        {tab === 'log' && (
          <div className="card p-5">
            {log.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có thay đổi nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {log.map((l) => (
                  <li key={l.id} className="py-2.5">
                    <p className="font-semibold">
                      {LOG_LABEL[l.action] ?? l.action}
                      <span className="font-normal text-slate-500"> · {timeAgo(l.created_at)}</span>
                    </p>
                    {l.target && <p className="font-mono text-xs text-slate-500">{l.target.slice(0, 8).toUpperCase()}</p>}
                    {'note' in l.details && <p className="text-slate-600">{String(l.details.note)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const LOG_LABEL: Record<string, string> = {
  update_settings: '⚙️ Đổi cấu hình',
  resolve_dispute: '⚖️ Xử lý khiếu nại',
  withdraw_bid: '🗑️ Gỡ báo giá',
  set_condition: '🛠️ Admin đổi điều kiện cọc / phí',
  demo_verify_deposit: '🧪 Xác nhận cọc (mô phỏng)',
  demo_pay_platform_fee: '🧪 Phí nền tảng (mô phỏng)',
  contact_unlock: '🔓 Mở liên hệ',
};

function AdminOrderList({ orders, empty }: { orders: AdminOrder[]; empty: string }) {
  if (orders.length === 0) return <p className="card p-6 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/don-hang/${o.id}`} className="card block p-4 transition hover:ring-blue-300">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{o.request_title}</p>
                <p className="text-xs text-slate-500">
                  👤 {o.customer_name ?? '—'} · 🏪 {o.shop_name ?? '—'} · {timeAgo(o.updated_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold tabular-nums text-blue-700">{formatVnd(o.total)}</p>
                <p className="text-xs text-slate-500">cọc {formatVnd(o.deposit_amount)}{o.payment_mode === 'demo' && ' (mô phỏng)'}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <OrderStatusBadge status={o.status} />
              <PaymentBadge status={o.payment_status} />
              {o.payment_mode === 'demo' && <DemoBadge />}
              {o.open_dispute && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">Khiếu nại đang mở</span>}
            </div>
            {o.deposit_status && o.platform_fee_status && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${DEPOSIT_STATUS[o.deposit_status]?.cls ?? ''}`}>
                  Cọc: {DEPOSIT_STATUS[o.deposit_status]?.label ?? o.deposit_status}
                  {o.evidence_count ? ` · ${o.evidence_count} ảnh` : ''}
                </span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${FEE_STATUS[o.platform_fee_status]?.cls ?? ''}`}>
                  Phí {formatVnd(o.platform_fee_amount ?? 0)}: {FEE_STATUS[o.platform_fee_status]?.label ?? o.platform_fee_status}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  {o.contact_unlocked_at ? '🔓 Đã mở liên hệ' : '🔒 Chưa mở liên hệ'}
                </span>
                {o.needs_attention && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">⏰ Quá hạn xem xét</span>}
              </div>
            )}
            {o.deposit_note && <p className="mt-2 text-xs text-amber-800">💬 {o.deposit_note}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
