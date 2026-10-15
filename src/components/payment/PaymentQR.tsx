import { formatVnd } from '@/lib/format';

/** Câu cảnh báo bắt buộc hiện cạnh mọi mã QR. */
export const QR_DEMO_WARNING = 'DEMO QR — KHÔNG CHUYỂN TIỀN THẬT (DO NOT TRANSFER REAL MONEY)';

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-amber-400 px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-amber-950 ${className}`}
    >
      Demo
    </span>
  );
}

/** Dải cảnh báo DEMO cho các trang liên quan đến thanh toán. */
export function DemoNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div role="note" className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-bold">
        <DemoBadge /> Chế độ thử nghiệm — không có giao dịch thật
      </p>
      {children && <div className="mt-1 text-xs">{children}</div>}
    </div>
  );
}

/** Băm chuỗi thành số để vẽ hoa văn cố định cho mỗi mã tham chiếu. */
function seeded(ref: string) {
  let h = 2166136261;
  for (const ch of ref) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

/**
 * Hình QR MINH HOẠ — KHÔNG phải mã QR thật.
 * Cố ý chỉ có 2 ô định vị (mã QR thật cần 3) và dữ liệu ngẫu nhiên, nên app ngân hàng / máy quét
 * không đọc được → không thể dẫn tới giao dịch. Không chứa số tài khoản hay thông tin thanh toán nào.
 */
function DemoQrArt({ reference }: { reference: string }) {
  const N = 25;
  const rnd = seeded(reference);
  const cells: [number, number][] = [];
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.55) cells.push([x, y]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#0b1220" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#0b1220" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="h-full w-full" aria-hidden shapeRendering="crispEdges">
      <rect x={-1} y={-1} width={N + 2} height={N + 2} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="#94a3b8" />
      ))}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {/* Góc thứ 3 cố ý KHÔNG có ô định vị */}
      <text x={3.5} y={N - 2} fontSize={6} textAnchor="middle">🌸</text>
    </svg>
  );
}

type Props = {
  amount: number;
  reference: string;
  /** VD: "Tiền cọc cho shop", "Phí nền tảng Flomal" */
  purpose?: string;
};

/**
 * Khối "thanh toán QR" DEMO. Không tích hợp ngân hàng / cổng thanh toán.
 * ⚠️ Không thay bằng QR ngân hàng thật cho tới khi đã có cổng thanh toán và tắt chế độ demo.
 */
export default function PaymentQR({ amount, reference, purpose = 'Số tiền' }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-amber-400 bg-paper p-2">
        <DemoQrArt reference={reference} />
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] whitespace-nowrap rounded bg-amber-400/95 px-4 py-1 text-lg font-black tracking-[0.3em] text-amber-950 shadow"
          aria-hidden
        >
          DEMO
        </span>
      </div>
      <p role="alert" className="w-full rounded-xl bg-amber-400 px-3 py-2 text-center text-sm font-extrabold text-amber-950">
        ⚠️ {QR_DEMO_WARNING}
      </p>
      <dl className="w-full space-y-2 text-sm">
        <div className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <dt className="whitespace-nowrap text-slate-500">{purpose} (mô phỏng)</dt>
          <dd className="font-extrabold tabular-nums text-slate-700">{formatVnd(amount)}</dd>
        </div>
        <div className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
          <dt className="whitespace-nowrap text-slate-500">Mã tham chiếu thử</dt>
          <dd className="font-mono font-bold tracking-wider text-slate-600">{reference}</dd>
        </div>
        <p className="text-xs text-slate-500">
          Đây là hình minh hoạ, không quét được và không gắn với tài khoản ngân hàng nào. Xem hay quét hình này không xác nhận
          gì cả — dùng nút mô phỏng bên dưới để thử bước tiếp theo.
        </p>
      </dl>
    </div>
  );
}
