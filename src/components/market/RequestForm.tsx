'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import NotConfigured from '@/components/NotConfigured';
import DesignCard, { describeDesign } from '@/components/market/DesignCard';
import { CONTACT_WARNING, containsContact } from '@/lib/contact';
import { errMsg } from '@/lib/format';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { BouquetDesign } from '@/lib/types';

const MAX_FILES = 4;
const MAX_SIZE = 5 * 1024 * 1024;

export default function RequestForm() {
  const params = useSearchParams();
  const designId = params.get('design');
  const router = useRouter();
  const { user, loading } = useProfile();

  const [design, setDesign] = useState<BouquetDesign | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    budget_min: '',
    budget_max: '',
    needed_by: '',
    district: '',
    city: 'TP. Hồ Chí Minh',
    occasion: '',
    size_note: '',
    needed_time: '',
    card_message: '',
    delivery_address: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!designId || !supabaseConfigured) return;
    createClient()
      .from('bouquet_designs')
      .select('*')
      .eq('id', designId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as BouquetDesign;
        setDesign(d);
        setForm((f) => ({
          ...f,
          title: f.title || `Bó hoa ${d.name}`,
          description: f.description || describeDesign(d),
          budget_max: f.budget_max || String(d.total_price),
        }));
      });
  }, [designId]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  if (!supabaseConfigured) return <NotConfigured />;

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const picked = Array.from(e.target.files ?? []);
    const valid = picked.filter((f) => f.type.startsWith('image/') && f.size <= MAX_SIZE);
    if (valid.length < picked.length) setError('Chỉ nhận ảnh, mỗi ảnh tối đa 5MB.');
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    e.target.value = '';
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;
    if (form.title.trim().length < 3 || !form.description.trim()) {
      setError('Vui lòng nhập tiêu đề (ít nhất 3 ký tự) và mô tả.');
      return;
    }
    const min = form.budget_min ? Math.round(Number(form.budget_min)) : null;
    const max = form.budget_max ? Math.round(Number(form.budget_max)) : null;
    if (containsContact(form.title, form.description, form.size_note, form.card_message, form.occasion)) {
      setError(CONTACT_WARNING);
      return;
    }
    if (min !== null && max !== null && min > max) {
      setError('Ngân sách tối thiểu đang lớn hơn tối đa.');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const urls: string[] = design?.snapshot_url ? [design.snapshot_url] : [];
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${user.id}/requests/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('request-images').upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        urls.push(supabase.storage.from('request-images').getPublicUrl(path).data.publicUrl);
      }
      const { data, error: insErr } = await supabase
        .from('requests')
        .insert({
          customer_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          budget_min: min,
          budget_max: max,
          needed_by: form.needed_by || null,
          district: form.district.trim() || null,
          city: form.city.trim() || null,
          design_id: design?.id ?? null,
          image_urls: urls,
          occasion: form.occasion.trim() || null,
          size_note: form.size_note.trim() || null,
          needed_time: form.needed_time.trim() || null,
          card_message: form.card_message.trim() || null,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      // Địa chỉ giao hàng lưu riêng: chỉ bạn thấy; shop thắng chỉ thấy sau khi đã mở thông tin
      if (form.delivery_address.trim()) {
        const { error: addrErr } = await supabase
          .from('request_private')
          .insert({ request_id: data.id, delivery_address: form.delivery_address.trim() });
        if (addrErr) alert('Đã đăng yêu cầu nhưng chưa lưu được địa chỉ giao hàng: ' + errMsg(addrErr));
      }
      router.push(`/cho-hoa/${data.id}`);
    } catch (err) {
      setError('Không đăng được: ' + errMsg(err));
      setBusy(false);
    }
  };

  if (loading) return <p className="p-10 text-center text-slate-500">Đang tải…</p>;

  if (!user) {
    const next = '/cho-hoa/dang-yeu-cau' + (designId ? `?design=${designId}` : '');
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="card p-6 text-center">
          <p className="text-4xl" aria-hidden>🔐</p>
          <h1 className="mt-2 text-xl font-bold">Đăng nhập để đăng yêu cầu</h1>
          <p className="mt-1 text-sm text-slate-600">
            Khi chưa đăng nhập, bạn chỉ có thể thiết kế bó hoa và lưu mẫu trên máy này.
          </p>
          <Link href={`/dang-nhap?next=${encodeURIComponent(next)}`} className="btn-primary mt-5">
            Đăng nhập / Đăng ký
          </Link>
          <Link href="/thiet-ke" className="btn-outline mt-3 ml-2">
            🎨 Tiếp tục thiết kế
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold text-slate-800">Đăng yêu cầu bó hoa</h1>
      <p className="mt-1 text-slate-600">Mô tả càng rõ, báo giá càng sát. Các shop sẽ cạnh tranh để có giá tốt nhất cho bạn.</p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-5 p-6">
        {design && <DesignCard design={design} />}

        <div>
          <label className="label" htmlFor="occasion">Dịp tặng / mục đích</label>
          <input id="occasion" className="input" list="occasions" maxLength={80} placeholder="VD: Sinh nhật" value={form.occasion} onChange={set('occasion')} />
          <datalist id="occasions">
            {['Sinh nhật', 'Kỷ niệm', 'Tỏ tình / cầu hôn', 'Khai trương', 'Tốt nghiệp', 'Chúc mừng', 'Chia buồn', 'Tặng mẹ / thầy cô', 'Trang trí'].map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="title">Tiêu đề *</label>
          <input id="title" className="input" maxLength={140} placeholder="VD: Bó hồng đỏ 20 bông tặng sinh nhật" value={form.title} onChange={set('title')} />
        </div>

        <div>
          <label className="label" htmlFor="description">Mô tả *</label>
          <textarea
            id="description"
            className="input min-h-[160px]"
            maxLength={4000}
            placeholder="Loại hoa, màu sắc, kích thước, phong cách, lời nhắn trên thiệp…"
            value={form.description}
            onChange={set('description')}
          />
        </div>

        <div>
          <span className="label">Ảnh mẫu (tối đa {MAX_FILES} ảnh)</span>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-blue-100" />
                <button
                  type="button"
                  aria-label="Bỏ ảnh"
                  onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white ring-1 ring-white/20"
                >
                  ✕
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-blue-200 text-center text-xs text-slate-500 hover:border-blue-400">
                <span>📷<br />Thêm ảnh</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
              </label>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bmin">Ngân sách từ (₫)</label>
            <input id="bmin" type="number" min={0} step={10000} className="input" value={form.budget_min} onChange={set('budget_min')} />
          </div>
          <div>
            <label className="label" htmlFor="bmax">Ngân sách đến (₫)</label>
            <input id="bmax" type="number" min={0} step={10000} className="input" value={form.budget_max} onChange={set('budget_max')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="size_note">Số lượng / kích thước</label>
            <input id="size_note" className="input" maxLength={200} placeholder="VD: 20 bông, bó cỡ vừa (~40cm)" value={form.size_note} onChange={set('size_note')} />
          </div>
          <div>
            <label className="label" htmlFor="needed">Cần hoa ngày</label>
            <input id="needed" type="date" className="input" value={form.needed_by} onChange={set('needed_by')} />
          </div>
          <div>
            <label className="label" htmlFor="needed_time">Khung giờ giao</label>
            <input id="needed_time" className="input" maxLength={60} placeholder="VD: 9:00–11:00" value={form.needed_time} onChange={set('needed_time')} />
          </div>
          <div>
            <label className="label" htmlFor="district">Quận / huyện</label>
            <input id="district" className="input" placeholder="VD: Quận 3" value={form.district} onChange={set('district')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="city">Tỉnh / thành phố</label>
            <input id="city" className="input" value={form.city} onChange={set('city')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="delivery_address">Địa chỉ giao hàng</label>
            <input id="delivery_address" className="input" maxLength={300} placeholder="Số nhà, đường, phường" value={form.delivery_address} onChange={set('delivery_address')} />
            <p className="mt-1 text-xs text-slate-500">🔒 Chỉ bạn thấy. Shop được chọn chỉ thấy sau khi đã mở thông tin liên hệ.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="card_message">Lời nhắn trên thiệp & yêu cầu đặc biệt</label>
            <textarea id="card_message" className="input min-h-[70px]" maxLength={500} placeholder="VD: “Chúc mẹ luôn khoẻ!” — không dùng hoa có mùi hắc" value={form.card_message} onChange={set('card_message')} />
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link href="/cho-hoa" className="btn-outline">Huỷ</Link>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Đang đăng…' : '🛎️ Đăng yêu cầu'}
          </button>
        </div>
      </form>
    </div>
  );
}
