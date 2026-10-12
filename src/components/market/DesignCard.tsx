import { formatVnd } from '@/lib/format';
import type { BouquetDesign } from '@/lib/types';

/** Mô tả văn bản của một thiết kế — dùng điền sẵn vào yêu cầu. */
export function describeDesign(d: BouquetDesign) {
  const lines = d.items.map((i) => `- ${i.qty} × ${i.name}`);
  return [
    'Bó hoa theo thiết kế 3D của mình:',
    ...lines,
    `- Giấy gói: ${d.wrapper_name ?? '—'}`,
    `- Kiểu gói: ${d.style_name ?? '—'}`,
    `- Ruy băng: ${d.ribbon_color ?? '—'}`,
    '',
    `Giá tham khảo trên web: ${formatVnd(d.total_price)}. Mong các shop báo giá tốt nhé!`,
  ].join('\n');
}

export default function DesignCard({ design }: { design: BouquetDesign }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <p className="text-sm font-bold text-blue-700">🎨 Thiết kế 3D đính kèm</p>
      <div className="mt-3 flex gap-4">
        {design.snapshot_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={design.snapshot_url} alt="Ảnh chụp thiết kế" className="h-28 w-28 shrink-0 rounded-xl object-cover ring-1 ring-blue-100" />
        )}
        <div className="min-w-0 flex-1 text-sm">
          <ul className="space-y-0.5">
            {design.items.map((i) => (
              <li key={i.flowerId} className="flex justify-between gap-2">
                <span className="truncate">
                  {i.qty} × {i.name}
                </span>
                <span className="tabular-nums text-slate-500">{formatVnd(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            {design.wrapper_name} · {design.style_name}
            {design.ribbon_color && (
              <span
                className="ml-2 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-black/20"
                style={{ background: design.ribbon_color }}
                title="Màu ruy băng"
              />
            )}
          </p>
          <p className="mt-1 font-semibold">Giá tham khảo: {formatVnd(design.total_price)}</p>
        </div>
      </div>
    </div>
  );
}
