'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { errMsg, formatVnd } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { Bid } from '@/lib/types';

type Props = {
  requestId: string;
  shopId: string;
  myBid: Bid | null;
  lowest: number | null;
  onDone: () => void;
};

/** Shop gửi báo giá mới, hạ/sửa giá, hoặc rút báo giá. */
export default function BidForm({ requestId, shopId, myBid, lowest, onDone }: Props) {
  const [price, setPrice] = useState(myBid ? String(myBid.price) : '');
  const [message, setMessage] = useState(myBid?.message ?? '');
  const [delivery, setDelivery] = useState(myBid?.delivery_note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (myBid) setPrice(String(myBid.price));
  }, [myBid?.price]); // eslint-disable-line react-hooks/exhaustive-deps

  if (myBid?.status === 'rejected') {
    return <p className="text-sm text-stone-600">Khách đã từ chối báo giá của bạn cho yêu cầu này.</p>;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    const p = Math.round(Number(price));
    if (!p || p < 1000) {
      setError('Giá không hợp lệ (tối thiểu 1.000 ₫).');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const payload = { price: p, message: message.trim() || null, delivery_note: delivery.trim() || null, status: 'pending' as const };
    const { error } = myBid
      ? await supabase.from('bids').update(payload).eq('id', myBid.id)
      : await supabase.from('bids').insert({ ...payload, request_id: requestId, shop_id: shopId });
    setBusy(false);
    if (error) {
      setError(errMsg(error));
      return;
    }
    setOk(myBid ? 'Đã cập nhật báo giá.' : 'Đã gửi báo giá! 🎉');
    onDone();
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
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-lg font-bold">{isActive ? 'Báo giá của bạn' : 'Gửi báo giá'}</h3>
      {lowest !== null && (
        <p className={`rounded-xl px-3 py-2 text-sm ${notLowest ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-stone-700'}`}>
          Giá thấp nhất hiện tại: <b>{formatVnd(lowest)}</b>
          {notLowest && ' — hạ giá để vươn lên dẫn đầu!'}
        </p>
      )}
      <div>
        <label className="label" htmlFor="price">Giá trọn gói (₫) *</label>
        <input id="price" type="number" min={1000} step={5000} className="input" value={price} onChange={(e) => setPrice(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="msg">Lời nhắn cho khách</label>
        <textarea
          id="msg"
          className="input min-h-[90px]"
          maxLength={2000}
          placeholder="Hoa nhập từ đâu, có thiệp/giao miễn phí không, ảnh mẫu shop từng làm…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="delivery">Giao hàng</label>
        <input id="delivery" className="input" maxLength={300} placeholder="VD: Giao trong 2h, miễn phí nội thành" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {isActive ? 'Cập nhật giá' : myBid ? 'Gửi lại báo giá' : '🏷️ Gửi báo giá'}
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
