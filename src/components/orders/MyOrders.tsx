'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OrderStatusBadge, PaymentBadge } from '@/components/orders/OrderBadges';
import { DemoBadge } from '@/components/payment/PaymentQR';
import { formatVnd, timeAgo } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/lib/types';

type Row = Order & { request: { title: string } | null };

/** Danh sách đơn hàng của khách hoặc shop (RLS chỉ trả về đơn của chính mình). */
export default function MyOrders({ userId, role }: { userId: string; role: 'customer' | 'shop' }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    createClient()
      .from('orders')
      .select('*, request:requests(title)')
      .eq(role === 'customer' ? 'customer_id' : 'shop_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [userId, role]);

  return (
    <div className="card p-6 lg:col-span-2">
      <h2 className="text-lg font-bold">Đơn hàng của tôi</h2>
      {rows === null ? (
        <p className="mt-2 text-sm text-slate-500">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Chưa có đơn hàng. Đơn được tạo khi {role === 'customer' ? 'bạn chấp nhận một báo giá' : 'khách chấp nhận báo giá của bạn'}.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-blue-50">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/don-hang/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-blue-700">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.request?.title ?? 'Đơn hàng'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <OrderStatusBadge status={o.status} />
                    <PaymentBadge status={o.payment_status} />
                    {o.payment_mode === 'demo' && <DemoBadge />}
                    <span className="text-xs text-slate-500">{timeAgo(o.updated_at)}</span>
                  </div>
                </div>
                <p className="font-bold tabular-nums text-blue-700">{formatVnd(o.total)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
