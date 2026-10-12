import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import type { Catalogue, Flower, WrapStyle, Wrapper } from '@/lib/types';

/** Danh mục mẫu — dùng khi chưa kết nối Supabase. Giống hệt supabase/seed.sql. */
export const LOCAL_CATALOGUE: Catalogue = {
  flowers: [
    { id: 'hong-do', name: 'Hồng đỏ', kind: 'rose', price: 25000, color: '#c8102e', accent_color: '#8a0b20' },
    { id: 'hong-phan', name: 'Hồng phấn', kind: 'rose', price: 25000, color: '#f4a6b8', accent_color: '#e07a95' },
    { id: 'hong-trang', name: 'Hồng trắng', kind: 'rose', price: 28000, color: '#f8f4ec', accent_color: '#e8dcc8' },
    { id: 'tulip-vang', name: 'Tulip vàng', kind: 'tulip', price: 45000, color: '#f6c945', accent_color: '#e0a520' },
    { id: 'tulip-tim', name: 'Tulip tím', kind: 'tulip', price: 45000, color: '#8e5bb5', accent_color: '#6a3f8c' },
    { id: 'huong-duong', name: 'Hướng dương', kind: 'sunflower', price: 35000, color: '#f7b500', accent_color: '#5a3a1a' },
    { id: 'cuc-hoa-mi', name: 'Cúc họa mi', kind: 'daisy', price: 8000, color: '#ffffff', accent_color: '#f3c623' },
    { id: 'cam-chuong', name: 'Cẩm chướng', kind: 'carnation', price: 15000, color: '#e8587a', accent_color: '#c23a5c' },
    { id: 'cam-tu-cau', name: 'Cẩm tú cầu', kind: 'hydrangea', price: 65000, color: '#8fb3e8', accent_color: '#b9a5e0' },
    { id: 'lan-ho-diep', name: 'Lan hồ điệp', kind: 'orchid', price: 120000, color: '#f2e6f7', accent_color: '#b03a7a' },
    { id: 'baby-trang', name: 'Baby trắng (nhánh)', kind: 'baby', price: 15000, color: '#ffffff', accent_color: '#e9f2e4' },
    { id: 'la-bac', name: 'Lá bạc (eucalyptus)', kind: 'foliage', price: 10000, color: '#8fae9b', accent_color: '#6d8f7b' },
  ],
  wrappers: [
    { id: 'kraft', name: 'Giấy kraft nâu', price: 12000, color: '#b98b5e', opacity: 1 },
    { id: 'han-hong', name: 'Giấy Hàn hồng pastel', price: 18000, color: '#f6c9d4', opacity: 1 },
    { id: 'han-kem', name: 'Giấy Hàn màu kem', price: 18000, color: '#f3e6cf', opacity: 1 },
    { id: 'den-nham', name: 'Giấy đen nhám', price: 20000, color: '#2b2b2e', opacity: 1 },
    { id: 'luoi-trang', name: 'Giấy lưới trắng', price: 15000, color: '#ffffff', opacity: 0.55 },
    { id: 'kinh-trong', name: 'Giấy kính trong', price: 8000, color: '#dff3f7', opacity: 0.35 },
  ],
  styles: [
    { id: 'non', name: 'Gói hình nón', fee: 30000, shape: 'cone', description: 'Kiểu cổ điển, gọn tay' },
    { id: 'tron-han', name: 'Gói tròn kiểu Hàn', fee: 50000, shape: 'round', description: 'Nhiều lớp giấy xòe, sang trọng' },
    { id: 'bo-tay', name: 'Bó tay buộc nơ', fee: 20000, shape: 'handtied', description: 'Mộc mạc, lộ cuống hoa' },
  ],
};

export const RIBBON_COLOURS = [
  { name: 'Đỏ nhung', value: '#b3122e' },
  { name: 'Trắng', value: '#ffffff' },
  { name: 'Hồng', value: '#f29bb4' },
  { name: 'Vàng ánh kim', value: '#d4af37' },
  { name: 'Đen', value: '#232326' },
  { name: 'Xanh lá', value: '#6d8f7b' },
];

/** Đọc danh mục từ Supabase; lỗi hoặc bảng rỗng thì dùng danh mục mẫu. */
export async function loadCatalogue(): Promise<{ catalogue: Catalogue; source: 'supabase' | 'local' }> {
  const local = { catalogue: LOCAL_CATALOGUE, source: 'local' as const };
  if (!supabaseConfigured) return local;
  try {
    const supabase = createClient();
    const [f, w, s] = await Promise.all([
      supabase.from('flowers').select('*').eq('active', true).order('sort'),
      supabase.from('wrappers').select('*').eq('active', true).order('sort'),
      supabase.from('wrap_styles').select('*').eq('active', true).order('sort'),
    ]);
    if (f.error || w.error || s.error || !f.data?.length || !w.data?.length || !s.data?.length) return local;
    return {
      source: 'supabase',
      catalogue: {
        flowers: f.data as Flower[],
        wrappers: (w.data as Wrapper[]).map((x) => ({ ...x, opacity: Number(x.opacity) })),
        styles: s.data as WrapStyle[],
      },
    };
  } catch {
    return local;
  }
}
