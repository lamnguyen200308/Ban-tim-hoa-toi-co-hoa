import type { BouquetItem, FlowerPositions } from '@/lib/types';

/** Bản nháp đang thiết kế (trình thiết kế 3D đọc/ghi khoá này). */
export const DRAFT_KEY = 'btht-draft-v1';
export type Draft = { items: BouquetItem[]; wrapperId: string; styleId: string; ribbon: string; positions?: FlowerPositions };

/** Mẫu lưu trên máy — dành cho khách chưa đăng nhập. */
const SAVED_KEY = 'btht-saved-designs-v1';
const MAX_SAVED = 24;

export type LocalDesign = {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  stems: number;
  lines: { label: string; qty: number }[];
  thumb: string | null; // ảnh JPEG nhỏ (data URL)
  draft: Draft;
};

export function listLocalDesigns(): LocalDesign[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? (JSON.parse(raw) as LocalDesign[]) : [];
    return Array.isArray(list) ? list.filter((d) => d && d.id && d.draft) : [];
  } catch {
    return [];
  }
}

function write(list: LocalDesign[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

/** Lưu mẫu. Nếu bộ nhớ đầy thì bỏ ảnh của các mẫu cũ rồi thử lại. */
export function addLocalDesign(d: Omit<LocalDesign, 'id' | 'createdAt'>): LocalDesign {
  const item: LocalDesign = { ...d, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const list = [item, ...listLocalDesigns()].slice(0, MAX_SAVED);
  try {
    write(list);
  } catch {
    write(list.map((x, i) => (i === 0 ? x : { ...x, thumb: null })));
  }
  return item;
}

export function removeLocalDesign(id: string) {
  try {
    write(listLocalDesigns().filter((d) => d.id !== id));
  } catch {
    /* bỏ qua */
  }
}

/** Mở lại một mẫu trong trình thiết kế. */
export function loadIntoDesigner(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* bỏ qua */
  }
}

/** Thu nhỏ ảnh canvas thành JPEG ~320px để lưu gọn trong trình duyệt. */
export function thumbnailFrom(canvas: HTMLCanvasElement | null, size = 320): string | null {
  if (!canvas || !canvas.width) return null;
  try {
    const scale = size / Math.max(canvas.width, canvas.height);
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#eef3f9';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}
