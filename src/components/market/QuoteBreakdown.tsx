import { formatDate, formatVnd } from '@/lib/format';
import type { Bid } from '@/lib/types';

/** Ngày hôm nay dạng YYYY-MM-DD (giờ máy người xem). */
export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function isExpired(b: { valid_until?: string | null }) {
  return !!b.valid_until && b.valid_until < todayIso();
}

/** Chi tiết một báo giá: từng khoản phí, hoa dự kiến, hoa thay thế, hạn hiệu lực, điều kiện. */
export default function QuoteBreakdown({ bid, compact = false }: { bid: Partial<Bid>; compact?: boolean }) {
  const hasBreakdown = bid.flower_cost !== null && bid.flower_cost !== undefined;
  const rows: [string, number][] = hasBreakdown
    ? [
        ['Giá hoa', bid.flower_cost ?? 0],
        ['Thiết kế / gói', bid.design_fee ?? 0],
        ['Giao hàng', bid.delivery_fee ?? 0],
      ]
    : [];
  return (
    <div className="space-y-2 text-sm">
      {hasBreakdown && (
        <dl className="divide-y divide-slate-100 rounded-lg bg-white/70 px-3 ring-1 ring-slate-200">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5">
              <dt className="text-slate-500">{k}</dt>
              <dd className="tabular-nums">{formatVnd(v)}</dd>
            </div>
          ))}
          <div className="flex justify-between py-1.5 font-bold">
            <dt>Tổng</dt>
            <dd className="tabular-nums text-blue-700">{formatVnd(bid.price)}</dd>
          </div>
        </dl>
      )}
      {!hasBreakdown && !compact && <p className="text-xs text-slate-500">Giá trọn gói (báo giá cũ, chưa tách từng khoản).</p>}
      {bid.flowers_used && <p>🌷 <span className="text-slate-500">Hoa:</span> {bid.flowers_used}</p>}
      {bid.substitutions && <p>🔁 <span className="text-slate-500">Thay thế nếu hết:</span> {bid.substitutions}</p>}
      {bid.delivery_note && <p>🚚 {bid.delivery_note}</p>}
      {bid.conditions && <p className="whitespace-pre-line">📌 <span className="text-slate-500">Lưu ý:</span> {bid.conditions}</p>}
      {bid.message && <p className="whitespace-pre-line text-slate-700">💬 {bid.message}</p>}
      {bid.valid_until && (
        <p className={`text-xs ${isExpired(bid) ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
          ⏱ Hiệu lực đến {formatDate(bid.valid_until)}
          {isExpired(bid) && ' — đã hết hạn'}
        </p>
      )}
      {bid.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bid.image_url} alt="Ảnh mẫu của shop" className="h-28 w-28 rounded-lg object-cover ring-1 ring-slate-200" />
      )}
    </div>
  );
}
