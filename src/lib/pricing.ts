import type { BouquetItem, Catalogue, WrapShape } from '@/lib/types';

export const MAX_STEMS = 60;

/** Số tờ giấy gói: bó tay dùng 1 tờ; kiểu khác tối thiểu 2 tờ, thêm 1 tờ cho mỗi 8 cành. */
export function sheetsNeeded(stems: number, shape?: WrapShape) {
  if (!stems) return 0;
  if (shape === 'handtied') return 1;
  return Math.max(2, Math.ceil(stems / 8));
}

export type PriceLine = { id: string; label: string; qty: number; unit: number; total: number };

export function computePrice(items: BouquetItem[], catalogue: Catalogue, wrapperId: string, styleId: string) {
  const lines: PriceLine[] = [];
  for (const it of items) {
    const f = catalogue.flowers.find((x) => x.id === it.flowerId);
    if (f && it.qty > 0) lines.push({ id: f.id, label: f.name, qty: it.qty, unit: f.price, total: f.price * it.qty });
  }
  const stems = lines.reduce((s, l) => s + l.qty, 0);
  const flowersTotal = lines.reduce((s, l) => s + l.total, 0);
  const wrapper = catalogue.wrappers.find((w) => w.id === wrapperId) ?? catalogue.wrappers[0];
  const style = catalogue.styles.find((s) => s.id === styleId) ?? catalogue.styles[0];
  const sheets = sheetsNeeded(stems, style?.shape);
  const wrapperTotal = wrapper ? wrapper.price * sheets : 0;
  const styleFee = stems && style ? style.fee : 0;
  return {
    lines,
    stems,
    flowersTotal,
    wrapper,
    style,
    sheets,
    wrapperTotal,
    styleFee,
    total: flowersTotal + wrapperTotal + styleFee,
  };
}
