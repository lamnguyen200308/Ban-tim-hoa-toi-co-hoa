import type { Order, OrderStatus, PaymentStatus } from '@/lib/types';

/** Nhãn + màu trạng thái đơn hàng. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; icon: string; cls: string }> = {
  pending_confirmation: { label: 'Chờ xác nhận', icon: '⏳', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Đã xác nhận (demo)', icon: '✅', cls: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'Đang chuẩn bị hoa', icon: '💐', cls: 'bg-blue-100 text-blue-800' },
  delivering: { label: 'Đang giao hàng', icon: '🚚', cls: 'bg-blue-100 text-blue-800' },
  delivered: { label: 'Đã giao hàng', icon: '📦', cls: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Hoàn tất', icon: '🎉', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Đã huỷ', icon: '✖️', cls: 'bg-slate-200 text-slate-700' },
  disputed: { label: 'Đang xử lý khiếu nại', icon: '⚖️', cls: 'bg-red-100 text-red-800' },
};

/** Trạng thái thanh toán — luôn ghi rõ DEMO / mô phỏng. */
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  unpaid: { label: 'Chưa đặt cọc', cls: 'bg-slate-100 text-slate-700' },
  demo_paid: { label: 'Đã cọc (MÔ PHỎNG)', cls: 'bg-amber-100 text-amber-900' },
  demo_refunded: { label: 'Đã hoàn cọc (MÔ PHỎNG)', cls: 'bg-amber-100 text-amber-900' },
  paid: { label: 'Đã cọc', cls: 'bg-emerald-100 text-emerald-800' },
};

/** Các bước chính để vẽ thanh tiến trình. */
export const ORDER_STEPS: OrderStatus[] = ['pending_confirmation', 'confirmed', 'preparing', 'delivering', 'delivered', 'completed'];

export type OrderRole = 'customer' | 'shop' | 'admin';

export type OrderAction = {
  to: OrderStatus;
  label: string;
  style: 'primary' | 'accent' | 'outline';
  /** Bắt buộc ghi lý do */
  needsNote?: boolean;
  confirm?: string;
};

/**
 * Nút hành động hiển thị theo vai trò. Đây CHỈ là gợi ý giao diện —
 * quyền thật được kiểm tra trong hàm order_transition() ở database.
 */
export function orderActions(o: Order, role: OrderRole): OrderAction[] {
  const paid = o.payment_status === 'demo_paid' || o.payment_status === 'paid';
  const shopSide = role === 'shop' || role === 'admin';
  const cancelNeedsNote = o.payment_status !== 'unpaid';
  const cancel: OrderAction = {
    to: 'cancelled',
    label: 'Huỷ đơn',
    style: 'outline',
    needsNote: cancelNeedsNote,
    confirm: cancelNeedsNote
      ? 'Huỷ đơn đã đặt cọc? Tiền cọc KHÔNG mặc định bị mất — quản trị viên sẽ xem xét.'
      : 'Huỷ đơn này?',
  };
  switch (o.status) {
    case 'pending_confirmation':
      return [...(shopSide && paid ? [{ to: 'confirmed' as const, label: '✅ Xác nhận đơn', style: 'primary' as const }] : []), cancel];
    case 'confirmed':
      return [...(shopSide ? [{ to: 'preparing' as const, label: '💐 Bắt đầu chuẩn bị', style: 'primary' as const }] : []), cancel];
    case 'preparing':
      return shopSide ? [{ to: 'delivering', label: '🚚 Bắt đầu giao', style: 'primary' }] : [];
    case 'delivering':
      return shopSide ? [{ to: 'delivered', label: '📦 Đã giao xong', style: 'primary' }] : [];
    case 'delivered':
      return role === 'customer' || role === 'admin'
        ? [{ to: 'completed', label: '🎉 Đã nhận hoa — hoàn tất', style: 'accent', confirm: 'Xác nhận bạn đã nhận hoa đúng như báo giá?' }]
        : [];
    default:
      return [];
  }
}

export function canOpenDispute(o: Order, role: OrderRole) {
  return (role === 'customer' || role === 'shop') && ['confirmed', 'preparing', 'delivering', 'delivered'].includes(o.status);
}

export const DEPOSIT_DECISION: Record<string, string> = {
  refund_customer: 'Hoàn cọc cho khách',
  release_shop: 'Chuyển cọc cho shop',
  split: 'Chia cọc',
  none: 'Không thay đổi tiền cọc',
};

export const DISPUTE_OUTCOME: Record<string, string> = {
  completed: 'Đánh dấu hoàn tất',
  cancelled: 'Huỷ đơn',
  resume: 'Tiếp tục đơn (về trạng thái trước khiếu nại)',
};

export const ROLE_LABEL: Record<string, string> = {
  customer: 'Khách hàng',
  shop: 'Shop',
  admin: 'Quản trị viên',
  system: 'Hệ thống',
};
