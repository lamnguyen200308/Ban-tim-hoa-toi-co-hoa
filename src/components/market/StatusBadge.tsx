import type { BidStatus, RequestStatus } from '@/lib/types';

const REQUEST: Record<RequestStatus, [string, string]> = {
  open: ['Đang nhận báo giá', 'bg-emerald-100 text-emerald-700'],
  accepted: ['Đã chọn shop', 'bg-sky-100 text-sky-700'],
  closed: ['Đã đóng', 'bg-stone-200 text-stone-600'],
};

const BID: Record<BidStatus, [string, string]> = {
  pending: ['Đang chờ', 'bg-amber-100 text-amber-700'],
  accepted: ['Được chấp nhận', 'bg-emerald-100 text-emerald-700'],
  rejected: ['Bị từ chối', 'bg-stone-200 text-stone-600'],
  withdrawn: ['Đã rút', 'bg-stone-200 text-stone-600'],
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const [label, cls] = REQUEST[status] ?? REQUEST.open;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function BidStatusBadge({ status }: { status: BidStatus }) {
  const [label, cls] = BID[status] ?? BID.pending;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
