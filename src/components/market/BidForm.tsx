'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { errMsg, formatVnd } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { Bid } from '@/lib/types';
import { CONTACT_WARNING, containsContact } from '@/lib/contact';

type Props = {
  requestId: string;
  shopId: string;
  myBid: Bid | null;
  lowest: number | null;
  onDone: () => void;
};

const MAX_SIZE = 5 * 1024 * 1024;

/** Ngày sau n ngày, dạng YYYY-MM-DD theo giờ máy người dùng (tránh lệch múi giờ UTC). */
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

/** Shop gửi báo giá chi tiết (giá hoa, thiết kế, giao hàng…), hạ/sửa giá, hoặc rút báo giá. */
export default function BidForm({ requestId, shopId, myBid, lowest, onDone }: Props) {
  const init = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  const [f, setF] = useState({
    flower_cost: init(myBid?.flower_cost ?? (myBid && myBid.flower_cost === null ? myBid.price : null)),
    design_fee: init(myBid?.design_fee ?? 0),
    delivery_fee: init(myBid?.delivery_fee ?? 0),
    flowers_used: myBid?.flowers_used ?? '',
    substitutions: myBid?.substitutions ?? '',
    delivery_note: myBid?.delivery_note ?? '',
    valid_until: myBid?.valid_until ?? inDays(3),
    conditions: myBid?.conditions ?? '',
    message: myBid?.message ?? '',
  });
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (myBid?.flower_cost !== null && myBid?.flower_cost !== undefined) {
      setF((s) => ({ ...s, flower_cost: String(myBid.flower_cost) }));
    }
  }, [myBid?.flower_cost]);

  if (myBid?.status === 'rejected') {
    return <p className="text-sm text-slate-600">Khách đã từ chối báo giá của bạn cho yêu cầu này.</p>;
  }

  const total = num(f.flower_cost) + num(f.design_fee) + num(f.delivery_fee);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (num(f.flower_cost) < 1000 || total < 1000) {
      setError('Vui lòng nhập giá hoa (tối thiểu 1.000 ₫).');
      return;
    }
    if (f.valid_until && f.valid_until < inDays(0)) {
      setError('Hạn báo giá phải từ hôm nay trở đi.');
      return;
    }
    if (containsContact(f.message, f.delivery_note, f.flowers_used, f.substitutions, f.conditions)) {
      setError(CONTACT_WARNING);
      return;
    }
    if (image && (!image.type.startsWith('image/') || image.size > MAX_SIZE)) {
      setError('Ảnh mẫu phải là file ảnh, tối đa 5MB.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      let image_url = myBid?.image_url ?? null;
      if (image) {
        const ext = (image.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${shopId}/bids/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('request-images').upload(path, image, { contentType: image.type });
        if (upErr) throw upErr;
        image_url = supabase.storage.from('request-images').getPublicUrl(path).data.publicUrl;
      }
      const txt = (v: string) => v.trim() || null;
      const payload = {
        price: total,
        flower_cost: num(f.flower_cost),
        design_fee: num(f.design_fee),
        delivery_fee: num(f.delivery_fee),
        flowers_used: txt(f.flowers_used),
        substitutions: txt(f.substitutions),
        delivery_note: txt(f.delivery_note),
        valid_until: f.valid_until || null,
        conditions: txt(f.conditions),
        message: txt(f.message),
        image_url,
        status: 'pending' as const,
      };
      const { error } = myBid
        ? await supabase.from('bids').update(payload).eq('id', myBid.id)
        : await supabase.from('bids').insert({ ...payload, request_id: requestId, shop_id: shopId });
      if (error) throw error;
      setOk(myBid ? 'Đã cập nhật báo giá.' : 'Đã gửi báo giá! 🎉');
      setImage(null);
      onDone();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!myBid || !confirm('Rút báo giá này?')) return;
    setBusy(true);
    const { error } = await createClient().from('bids').update({ status: 'withdrawn' }).eq('id', myBid.id);
    setBusy(false);
    if (error) setError(errMsg(error));
    else onDone();
  };

  const isActive = myBid && myBid.status === 'pending';
  const notLowest = isActive && lowest !== null && myBid.price > lowest;

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="text-lg font-bold">{isActive ? 'Báo giá của bạn' : 'Gửi báo giá'}</h3>
      {lowest !== null && (
        <p className={`rounded-xl px-3 py-2 text-sm ${notLowest ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-slate-700'}`}>
          Giá thấp nhất hiện tại: <b>{formatVnd(lowest)}</b>
          {notLowest && ' — hạ giá để vươn lên dẫn đầu!'}
        </p>
      )}

      <fieldset className="space-y-3 rounded-xl bg-slate-50 p-3">
        <legend className="panel-title !mb-0 px-1">Chi phí (₫)</legend>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label !text-xs" htmlFor="flower_cost">Giá hoa *</label>
            <input id="flower_cost" type="number" inputMode="numeric" min={0} step={5000} className="input" value={f.flower_cost} onChange={set('flower_cost')} required />
          </div>
          <div>
            <label className="label !text-xs" htmlFor="design_fee">Thiết kế</label>
            <input id="design_fee" type="number" inputMode="numeric" min={0} step={5000} className="input" value={f.design_fee} onChange={set('design_fee')} />
          </div>
          <div>
            <label className="label !text-xs" htmlFor="delivery_fee">Giao hàng</label>
            <input id="delivery_fee" type="number" inputMode="numeric" min={0} step={5000} className="input" value={f.delivery_fee} onChange={set('delivery_fee')} />
          </div>
        </div>
        <p className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
          <span className="text-slate-600">Tổng giá cuối cùng</span>
          <b className="text-lg tabular-nums text-blue-700">{formatVnd(total)}</b>
        </p>
        <p className="text-xs text-slate-500">Khách thấy đủ từng khoản trước khi đồng ý. Không được cộng thêm phí ngoài báo giá.</p>
      </fieldset>

      <div>
        <label className="label" htmlFor="flowers_used">Hoa dự kiến sử dụng</label>
        <input id="flowers_used" className="input" maxLength={500} placeholder="VD: 20 hồng Ecuador đỏ, baby trắng, lá bạc" value={f.flowers_used} onChange={set('flowers_used')} />
      </div>
      <div>
        <label className="label" htmlFor="substitutions">Hoa thay thế nếu hết hàng</label>
        <input id="substitutions" className="input" maxLength={500} placeholder="VD: Hồng Đà Lạt cùng màu" value={f.substitutions} onChange={set('substitutions')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="delivery">Thời gian chuẩn bị & giao</label>
          <input id="delivery" className="input" maxLength={300} placeholder="VD: Chuẩn bị 2h, giao trong ngày" value={f.delivery_note} onChange={set('delivery_note')} />
        </div>
        <div>
          <label className="label" htmlFor="valid_until">Báo giá có hiệu lực đến</label>
          <input id="valid_until" type="date" min={inDays(0)} className="input" value={f.valid_until} onChange={set('valid_until')} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="conditions">Điều kiện cần lưu ý</label>
        <textarea id="conditions" className="input min-h-[60px]" maxLength={1000} placeholder="VD: Đổi màu giấy miễn phí; hoa theo mùa có thể khác nhẹ về sắc độ" value={f.conditions} onChange={set('conditions')} />
      </div>
      <div>
        <label className="label" htmlFor="msg">Lời nhắn cho khách</label>
        <textarea
          id="msg"
          className="input min-h-[70px]"
          maxLength={2000}
          placeholder="Không ghi SĐT / email — khách thấy liên hệ sau khi thanh toán"
          value={f.message}
          onChange={set('message')}
        />
      </div>
      <div>
        <span className="label">Ảnh mẫu tham khảo</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />
        {myBid?.image_url && !image && <p className="mt-1 text-xs text-slate-500">Đã có ảnh mẫu — chọn ảnh mới để thay.</p>}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Đang gửi…' : isActive ? 'Cập nhật báo giá' : myBid ? 'Gửi lại báo giá' : '🏷️ Gửi báo giá'}
        </button>
        {isActive && (
          <button type="button" className="btn-outline" disabled={busy} onClick={withdraw}>
            Rút
          </button>
        )}
      </div>
    </form>
  );
}
