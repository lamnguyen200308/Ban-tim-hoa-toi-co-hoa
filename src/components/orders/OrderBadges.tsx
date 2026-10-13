import { ORDER_STATUS, PAYMENT_STATUS } from '@/lib/orders';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status] ?? ORDER_STATUS.pending_confirmation;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.unpaid;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
