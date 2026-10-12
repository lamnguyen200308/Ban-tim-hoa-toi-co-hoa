import { formatVnd } from '@/lib/format';

/**
 * ⚠️ PLACEHOLDER — chỗ đặt mã QR thanh toán của bạn.
 *
 * Khi đã có QR (VietQR / MoMo / ZaloPay…), thay khối "placeholder" bên dưới bằng ảnh hoặc component QR, ví dụ:
 *   <img src={`https://img.vietqr.io/image/<BANK>-<STK>-compact.png?amount=${amount}&addInfo=${reference}`} … />
 * Nhớ đưa `reference` vào nội dung chuyển khoản: webhook dùng mã này để xác nhận đã trả tiền
 * (xem src/app/api/payment/webhook/route.ts).
 */
export default function PaymentQR({ amount, reference }: { amount: number; reference: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* ===== PLACEHOLDER QR — thay bằng mã QR thật ===== */}
      <div
        className="grid h-44 w-44 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-blue-300 bg-[repeating-linear-gradient(45deg,#eff6ff_0_10px,#ffffff_10px_20px)] text-center"
        role="img"
        aria-label="Chỗ đặt mã QR thanh toán"
      >
        <div className="px-3">
          <p className="text-4xl" aria-hidden>▦</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-blue-700">Mã QR</p>
          <p className="text-[11px] text-slate-500">(placeholder)</p>
        </div>
      </div>
      {/* ================================================ */}
      <dl className="w-full space-y-2 text-sm">
        <div className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <dt className="whitespace-nowrap text-slate-500">Số tiền</dt>
          <dd className="font-extrabold tabular-nums text-blue-700">{formatVnd(amount)}</dd>
        </div>
        <div className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <dt className="whitespace-nowrap text-slate-500">Nội dung CK</dt>
          <dd className="font-mono font-bold tracking-wider">{reference}</dd>
        </div>
        <p className="text-xs text-slate-500">
          Quét mã bằng app ngân hàng. Thông tin liên hệ sẽ tự hiện ngay khi hệ thống nhận được thanh toán.
        </p>
      </dl>
    </div>
  );
}
