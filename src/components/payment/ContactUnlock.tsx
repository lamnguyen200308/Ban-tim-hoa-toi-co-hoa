'use client';

import { useCallback, useEffect, useState } from 'react';
import PaymentQR from '@/components/payment/PaymentQR';
import { errMsg } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { ContactUnlock as Unlock, Counterpart } from '@/lib/types';

/**
 * Sau khi chốt báo giá: người xem quét QR thanh toán → mở thông tin liên hệ của bên kia.
 * Khách thấy thông tin shop; shop thắng thấy thông tin khách. Mỗi bên trả riêng.
 */
export default function ContactUnlock({ requestId, viewerRole }: { requestId: string; viewerRole: 'customer' | 'shop' }) {
  const [unlock, setUnlock] = useState<Unlock | null>(null);
  const [contact, setContact] = useState<Counterpart | null>(null);
  const [demo, setDemo] = useState(false);
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const other = viewerRole === 'customer' ? 'shop' : 'khách hàng';

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: u } = await supabase.from('contact_unlocks').select('*').eq('request_id', requestId).maybeSingle();
    setUnlock((u as Unlock | null) ?? null);
    if ((u as Unlock | null)?.status === 'paid') {
      const { data: c } = await supabase.rpc('get_counterpart_contact', { p_request_id: requestId });
      setContact(((c as Counterpart[] | null) ?? [])[0] ?? null);
    }
  }, [requestId]);

  useEffect(() => {
    const supabase = createClient();
    refresh();
    supabase
      .from('app_settings')
      .select('payment_demo, unlock_fee_customer, unlock_fee_shop')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDemo(!!data.payment_demo);
        setFee(viewerRole === 'customer' ? data.unlock_fee_customer : data.unlock_fee_shop);
      });
    // Thanh toán xong (webhook cập nhật) → tự mở thông tin
    const channel = supabase
      .channel(`unlock-${requestId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_unlocks', filter: `request_id=eq.${requestId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, refresh, viewerRole]);

  const start = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc('start_contact_unlock', { p_request_id: requestId });
    setBusy(false);
    if (error) setError(errMsg(error));
    else setUnlock(data as Unlock);
  };

  const simulatePaid = async () => {
    if (!unlock) return;
    setBusy(true);
    const { error } = await createClient().rpc('demo_confirm_unlock', { p_unlock_id: unlock.id });
    setBusy(false);
    if (error) setError(errMsg(error));
    else refresh();
  };

  if (unlock?.status === 'paid' && contact) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200">
        <p className="font-semibold text-emerald-800">🔓 Thông tin {other}</p>
        <p className="mt-1">{viewerRole === 'customer' ? '🏪' : '👤'} {contact.name || '—'}</p>
        <p>📞 {contact.phone || 'Chưa cập nhật số điện thoại'}</p>
        {contact.address && <p>🏠 {contact.address}</p>}
        {(contact.district || contact.city) && <p>📍 {[contact.district, contact.city].filter(Boolean).join(', ')}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-white p-3 text-sm ring-1 ring-blue-200">
      <p className="font-semibold">🔒 Thông tin {other} đang được giữ kín</p>
      <div className="mt-2 space-y-1 text-slate-500" aria-hidden>
        <p>
          {viewerRole === 'customer' ? '🏪' : '👤'} <span className="redacted px-10">ẩn</span>
        </p>
        <p>
          📞 <span className="redacted px-14">ẩn</span>
        </p>
      </div>

      {!unlock ? (
        <>
          <p className="mt-3 text-slate-600">
            Quét QR thanh toán{fee !== null ? ' ' + new Intl.NumberFormat('vi-VN').format(fee) + ' ₫' : ''} để xem tên và số điện thoại
            của {other}.
          </p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={start}>
            📱 Lấy mã QR thanh toán
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <PaymentQR amount={unlock.amount} reference={unlock.payment_ref} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline !px-4 !py-1.5 text-xs" disabled={busy} onClick={refresh}>
              🔄 Tôi đã thanh toán — kiểm tra
            </button>
            {demo && (
              <button type="button" className="btn-accent !px-4 !py-1.5 text-xs" disabled={busy} onClick={simulatePaid}>
                🧪 Giả lập đã quét QR (chế độ thử)
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
