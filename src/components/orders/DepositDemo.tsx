'use client';

import { useState } from 'react';
import PaymentQR, { DemoBadge, DemoNotice } from '@/components/payment/PaymentQR';
import { errMsg, formatVnd } from '@/lib/format';
import { PAYMENT_STATUS, type OrderRole } from '@/lib/orders';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/lib/types';

/**
 * Bước đặt cọc — CHỈ MÔ PHỎNG. Không có ngân hàng, không có tiền thật.
 * Mở trang hay xem QR không tự xác nhận gì: chỉ khi khách bấm "Mô phỏng thanh toán thành công"
 * thì database mới ghi payment_status = 'demo_paid'.
 */
export default function DepositDemo({
  order,
  role,
  demoEnabled,
  onChange,
}: {
  order: Order;
  role: OrderRole;
  demoEnabled: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const isDemo = order.payment_mode === 'demo';
  const pay = PAYMENT_STATUS[order.payment_status];
  const remaining = Math.max(0, order.total - order.deposit_amount);
  const canPay = role === 'customer' && order.status === 'pending_confirmation' && order.payment_status === 'unpaid';

  const simulate = async () => {
    if (!confirm('Đây chỉ là MÔ PHỎNG, không có tiền thật được chuyển. Tiếp tục?')) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc('demo_pay_deposit', { p_order_id: order.id });
    setBusy(false);
    if (error) setError(errMsg(error));
    else onChange();
  };

  // Mã tham chiếu hiển thị — chỉ để minh hoạ
  const reference = 'DEMO' + order.id.replace(/-/g, '').slice(0, 8).toUpperCase();

  return (
    <section className="card space-y-4 p-5" aria-labelledby="deposit-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deposit-title" className="flex items-center gap-2 text-lg font-bold">
          Đặt cọc {isDemo && <DemoBadge />}
        </h2>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${pay.cls}`}>{pay.label}</span>
      </div>

      {isDemo && (
        <DemoNotice>Mọi số tiền và trạng thái ở bước này là dữ liệu thử nghiệm — không phải tiền đã chuyển hay đã nhận.</DemoNotice>
      )}

      <dl className="divide-y divide-slate-100 rounded-xl bg-slate-50 px-3 text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Tổng giá trị đơn</dt>
          <dd className="font-semibold tabular-nums">{formatVnd(order.total)}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Tỷ lệ đặt cọc</dt>
          <dd className="font-semibold tabular-nums">{order.deposit_percent}%</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Tiền cọc {isDemo && '(mô phỏng)'}</dt>
          <dd className="font-extrabold tabular-nums text-blue-700">{formatVnd(order.deposit_amount)}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Còn lại dự kiến (trả khi nhận hoa)</dt>
          <dd className="font-semibold tabular-nums">{formatVnd(remaining)}</dd>
        </div>
      </dl>

      {order.deposit_note && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">💬 {order.deposit_note}</p>}

      {canPay &&
        (isDemo && demoEnabled ? (
          showQr ? (
            <div className="space-y-3">
              <PaymentQR amount={order.deposit_amount} reference={reference} purpose="Tiền cọc" />
              <button type="button" className="btn-accent w-full" disabled={busy} onClick={simulate}>
                🧪 Mô phỏng thanh toán thành công
              </button>
            </div>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={() => setShowQr(true)}>
              📱 Xem QR đặt cọc (demo)
            </button>
          )
        ) : (
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
            Website chưa nối cổng thanh toán thật{!demoEnabled && ' và chế độ demo đang tắt'}, nên chưa thể đặt cọc cho đơn này.
          </p>
        ))}

      {role === 'shop' && order.payment_status === 'unpaid' && order.status === 'pending_confirmation' && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-slate-700">⏳ Đang chờ khách đặt cọc. Sau đó bạn mới xác nhận đơn được.</p>
      )}
      {order.payment_status === 'demo_paid' && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          🧪 Khách đã đặt cọc <b>MÔ PHỎNG</b> — shop <b>chưa nhận</b> được tiền thật nào.
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
