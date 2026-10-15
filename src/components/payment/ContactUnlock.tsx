'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DemoBadge } from '@/components/payment/PaymentQR';
import { formatDate } from '@/lib/format';
import { DEPOSIT_STATUS, FEE_STATUS, conditionValid } from '@/lib/orders';
import { createClient } from '@/lib/supabase/client';
import type { Counterpart, Order } from '@/lib/types';

type OrderLite = Pick<
  Order,
  'id' | 'payment_mode' | 'platform_fee_mode' | 'deposit_status' | 'platform_fee_status' | 'contact_unlocked_at'
>;

/**
 * Thẻ liên hệ bên kia. Liên hệ CHỈ được database trả về khi đơn đã đủ 2 điều kiện
 * (cọc + phí nền tảng). Trước đó trình duyệt không hề nhận tên / SĐT / địa chỉ — phần "ẩn"
 * dưới đây chỉ là hình minh hoạ, không phải dữ liệu bị che bằng CSS.
 */
export default function ContactUnlock({
  requestId,
  viewerRole,
  showOrderLink = false,
}: {
  requestId: string;
  viewerRole: 'customer' | 'shop';
  showOrderLink?: boolean;
}) {
  const [order, setOrder] = useState<OrderLite | null>(null);
  const [contact, setContact] = useState<Counterpart | null>(null);
  const [loaded, setLoaded] = useState(false);

  const other = viewerRole === 'customer' ? 'shop' : 'khách hàng';

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('id, payment_mode, platform_fee_mode, deposit_status, platform_fee_status, contact_unlocked_at')
      .eq('request_id', requestId)
      .maybeSingle();
    const o = (data as OrderLite | null) ?? null;
    setOrder(o);
    if (o?.contact_unlocked_at) {
      const { data: c } = await supabase.rpc('get_counterpart_contact', { p_request_id: requestId });
      setContact(((c as Counterpart[] | null) ?? [])[0] ?? null);
    } else {
      setContact(null);
    }
    setLoaded(true);
  }, [requestId]);

  useEffect(() => {
    const supabase = createClient();
    refresh();
    // Điều kiện thay đổi (shop xác nhận cọc / trả phí) → tự cập nhật
    const channel = supabase
      .channel(`unlock-${requestId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `request_id=eq.${requestId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, refresh]);

  if (!loaded) return <p className="mt-3 text-sm text-slate-500">Đang tải…</p>;

  if (order?.contact_unlocked_at && contact) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-emerald-800">
          🔓 Thông tin {other}
          {order.payment_mode === 'demo' && <DemoBadge />}
        </p>
        {order.payment_mode === 'demo' && (
          <p className="text-xs text-amber-800">Mở nhờ cọc + phí nền tảng MÔ PHỎNG — không có tiền thật được chuyển.</p>
        )}
        <p className="mt-1">{viewerRole === 'customer' ? '🏪' : '👤'} {contact.name || '—'}</p>
        <p>📞 {contact.phone || 'Chưa cập nhật số điện thoại'}</p>
        {contact.address && <p>🏠 {contact.address}</p>}
        {(contact.district || contact.city) && <p>📍 {[contact.district, contact.city].filter(Boolean).join(', ')}</p>}
        <p className="mt-1 text-xs text-slate-500">Mở lúc {formatDate(order.contact_unlocked_at)}</p>
      </div>
    );
  }

  const feeMode = order?.platform_fee_mode ?? order?.payment_mode;
  const depositOk = !!order && conditionValid(order.payment_mode, order.deposit_status);
  const feeOk = !!order && conditionValid(feeMode, order.platform_fee_status);

  return (
    <div className="mt-3 rounded-xl bg-surface p-3 text-sm ring-1 ring-blue-200">
      <p className="font-semibold">🔒 Thông tin {other} đang được giữ kín</p>
      <div className="mt-2 space-y-1 text-slate-500" aria-hidden>
        <p>
          {viewerRole === 'customer' ? '🏪' : '👤'} <span className="redacted px-10">ẩn</span>
        </p>
        <p>
          📞 <span className="redacted px-14">ẩn</span>
        </p>
      </div>

      {order ? (
        <>
          <p className="mt-3 text-slate-600">Liên hệ chỉ mở khi đơn đủ cả 2 điều kiện:</p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-start gap-2">
              <span aria-hidden>{depositOk ? '✅' : '⬜'}</span>
              <span>
                <b>Cọc</b> — {DEPOSIT_STATUS[order.deposit_status]?.label ?? order.deposit_status}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>{feeOk ? '✅' : '⬜'}</span>
              <span>
                <b>Phí nền tảng</b> (shop trả) — {FEE_STATUS[order.platform_fee_status]?.label ?? order.platform_fee_status}
              </span>
            </li>
          </ul>
          {showOrderLink && (
            <Link href={`/don-hang/${order.id}`} className="btn-primary mt-3 w-full">
              Xem đơn hàng & các bước còn lại
            </Link>
          )}
        </>
      ) : (
        <p className="mt-3 text-slate-600">Chưa có đơn hàng cho yêu cầu này.</p>
      )}
    </div>
  );
}
