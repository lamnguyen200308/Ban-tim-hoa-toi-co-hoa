'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PaymentQR, { DemoBadge, DemoNotice } from '@/components/payment/PaymentQR';
import { errMsg, formatVnd, timeAgo } from '@/lib/format';
import { BUCKET_DEPOSIT, DEPOSIT_STATUS, FEE_STATUS, conditionValid, type OrderRole } from '@/lib/orders';
import { createClient } from '@/lib/supabase/client';
import type { DepositEvidence, Order } from '@/lib/types';

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Cond = 'deposit' | 'platform_fee';

/**
 * Hai điều kiện để mở liên hệ: (A) cọc — shop gửi bằng chứng rồi xác nhận, (B) phí nền tảng — shop trả.
 * TẤT CẢ chỉ là MÔ PHỎNG. Mọi kiểm tra quyền và quy tắc "đủ cả 2 mới mở" nằm trong database;
 * các nút ở đây chỉ gọi hàm RPC, không tự đổi trạng thái.
 */
export default function UnlockConditions({
  order,
  role,
  userId,
  demoEnabled,
  onChange,
}: {
  order: Order;
  role: OrderRole;
  userId: string;
  demoEnabled: boolean;
  onChange: () => void;
}) {
  const [evidence, setEvidence] = useState<DepositEvidence[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [showDepositQr, setShowDepositQr] = useState(false);
  const [showFeeQr, setShowFeeQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDemo = order.payment_mode === 'demo';
  const feeMode = order.platform_fee_mode ?? order.payment_mode;
  const unlocked = !!order.contact_unlocked_at;
  const open = !unlocked && ['pending_confirmation', 'confirmed', 'preparing', 'delivering', 'delivered'].includes(order.status);
  const depositOk = conditionValid(order.payment_mode, order.deposit_status);
  const feeOk = conditionValid(feeMode, order.platform_fee_status);
  const canDemo = isDemo && demoEnabled;
  const ref = order.id.replace(/-/g, '').slice(0, 8).toUpperCase();

  const loadEvidence = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('deposit_evidence')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as DepositEvidence[];
    setEvidence(rows);
    if (rows.length) {
      const { data: signed } = await supabase.storage.from(BUCKET_DEPOSIT).createSignedUrls(rows.map((r) => r.storage_path), 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      setUrls(map);
    }
  }, [order.id]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence, order.deposit_status, order.deposit_evidence_at]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return false;
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      setError(errMsg(error));
      return false;
    }
    onChange();
    return true;
  };

  const rpc = (name: string, args: Record<string, unknown>) => createClient().rpc(name, args);

  const markDeposit = () =>
    run(
      () => rpc('demo_pay_deposit', { p_order_id: order.id }),
      'Đây chỉ là MÔ PHỎNG: không có tiền thật được chuyển. Báo cho shop rằng bạn đã chuyển cọc (demo)?',
    );

  const uploadEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError('Chỉ nhận ảnh PNG, JPG hoặc WEBP.');
    if (file.size > MAX_SIZE) return setError('Ảnh tối đa 5 MB.');
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${order.id}/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET_DEPOSIT).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.rpc('submit_deposit_evidence', { p_order_id: order.id, p_path: path, p_note: note || null });
      if (error) throw error;
      setFile(null);
      setNote('');
      onChange();
      loadEvidence();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyDeposit = () =>
    run(
      () => rpc('demo_verify_deposit', { p_order_id: order.id }),
      'Xác nhận đã nhận cọc ở chế độ MÔ PHỎNG? Không có tiền thật nào được ghi nhận.',
    );

  const payFee = () =>
    run(
      () => rpc('demo_pay_platform_fee', { p_order_id: order.id }),
      'Đây chỉ là MÔ PHỎNG: không có tiền thật, không có hoá đơn. Tiếp tục?',
    );

  const dispute = (c: Cond) => {
    const reason = prompt(
      `Mô tả vấn đề về ${c === 'deposit' ? 'tiền cọc' : 'phí nền tảng'} (ít nhất 5 ký tự). Quản trị viên sẽ xem lịch sử đơn và bằng chứng:`,
    );
    if (!reason?.trim()) return;
    run(() => rpc('dispute_condition', { p_order_id: order.id, p_condition: c, p_reason: reason }));
  };

  const adminSet = (c: Cond, status: 'verified_demo' | 'rejected' | 'pending') => {
    const label = status === 'verified_demo' ? 'XÁC NHẬN (mô phỏng)' : status === 'rejected' ? 'TỪ CHỐI' : 'MỞ LẠI';
    const reason = prompt(`${label} ${c === 'deposit' ? 'tiền cọc' : 'phí nền tảng'}. Lý do (bắt buộc, được ghi nhật ký):`);
    if (!reason?.trim()) return;
    run(() => rpc('admin_set_condition', { p_order_id: order.id, p_condition: c, p_status: status, p_note: reason }));
  };

  const canDispute = (role === 'customer' || role === 'shop') && order.status === 'pending_confirmation' && !unlocked;
  const dep = DEPOSIT_STATUS[order.deposit_status] ?? DEPOSIT_STATUS.pending;
  const fee = FEE_STATUS[order.platform_fee_status] ?? FEE_STATUS.pending;

  return (
    <section className="card space-y-4 p-5" aria-labelledby="cond-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cond-title" className="flex items-center gap-2 text-lg font-bold">
          Mở liên hệ {isDemo && <DemoBadge />}
        </h2>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {unlocked ? '🔓 Đã mở' : `🔒 ${Number(depositOk) + Number(feeOk)}/2 điều kiện`}
        </span>
      </div>

      {isDemo && (
        <DemoNotice>
          Cọc và phí nền tảng ở đây đều là MÔ PHỎNG. Không có tiền thật được chuyển, nhận hay ghi là doanh thu.
        </DemoNotice>
      )}

      {unlocked ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          🔓 Đã đủ 2 điều kiện — liên hệ được mở {timeAgo(order.contact_unlocked_at!)}. Mở liên hệ không có nghĩa đơn đã giao hay đã
          thanh toán đủ.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Liên hệ của hai bên chỉ mở khi <b>cả hai</b> điều kiện dưới đây hợp lệ. Thiếu, bị từ chối hoặc đang tranh chấp một điều kiện
          thì vẫn khoá.
        </p>
      )}

      {/* ── Điều kiện A: Cọc ── */}
      <div className="rounded-xl bg-raised p-4 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">
            <span aria-hidden>{depositOk ? '✅' : 'A.'}</span> Cọc cho shop
          </h3>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${dep.cls}`}>
            <span aria-hidden>{dep.icon}</span>
            {dep.label}
          </span>
        </div>

        <dl className="mt-3 divide-y divide-slate-100 rounded-xl bg-surface px-3 text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-slate-500">Tổng giá trị đơn</dt>
            <dd className="font-semibold tabular-nums">{formatVnd(order.total)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-slate-500">Cọc {order.deposit_percent}%{isDemo && ' (mô phỏng)'}</dt>
            <dd className="font-extrabold tabular-nums text-blue-700">{formatVnd(order.deposit_amount)}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-slate-500">Còn lại dự kiến (trả khi nhận hoa)</dt>
            <dd className="font-semibold tabular-nums">{formatVnd(order.remaining_amount ?? order.total - order.deposit_amount)}</dd>
          </div>
        </dl>

        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {order.deposit_customer_marked_at && <li>👤 Khách báo đã chuyển cọc (mô phỏng) · {timeAgo(order.deposit_customer_marked_at)}</li>}
          {order.deposit_evidence_at && <li>📸 Shop gửi bằng chứng · {timeAgo(order.deposit_evidence_at)}</li>}
          {order.deposit_verified_at && (
            <li>
              ✅ Xác nhận {order.deposit_verification_method === 'demo_admin' ? 'bởi quản trị viên' : order.deposit_verification_method === 'legacy_demo' ? '(đơn cũ)' : 'bởi shop'}{' '}
              · {timeAgo(order.deposit_verified_at)}
            </li>
          )}
        </ul>
        {order.deposit_status_note && ['rejected', 'disputed'].includes(order.deposit_status) && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">💬 {order.deposit_status_note}</p>
        )}

        {/* Khách: QR cọc minh hoạ + báo đã chuyển (không làm điều kiện hợp lệ) */}
        {role === 'customer' && open && ['pending', 'rejected', 'pending_verification'].includes(order.deposit_status) && (
          <div className="mt-3 space-y-3">
            {canDemo ? (
              showDepositQr ? (
                <>
                  <PaymentQR amount={order.deposit_amount} reference={`COC${ref}`} purpose="Tiền cọc cho shop" />
                  <p className="text-xs text-slate-500">
                    Bản chạy thật: shop tự cung cấp QR nhận cọc của họ. Hiện chỉ là hình minh hoạ, không gắn tài khoản nào.
                  </p>
                  {!order.deposit_customer_marked_at && (
                    <button type="button" className="btn-accent w-full" disabled={busy} onClick={markDeposit}>
                      🧪 Mô phỏng: tôi đã chuyển cọc
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className="btn-primary w-full" onClick={() => setShowDepositQr(true)}>
                  📱 Xem QR cọc (DEMO)
                </button>
              )
            ) : (
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                Chưa nối thanh toán thật{!demoEnabled && ' và chế độ demo đang tắt'}, nên chưa đặt cọc được.
              </p>
            )}
            <p className="text-xs text-slate-500">Sau khi bạn chuyển, shop gửi bằng chứng và xác nhận đã nhận cọc.</p>
          </div>
        )}

        {/* Shop: gửi bằng chứng + xác nhận */}
        {role === 'shop' && open && ['pending', 'rejected', 'pending_verification'].includes(order.deposit_status) && (
          <form onSubmit={uploadEvidence} className="mt-3 space-y-2">
            <label className="label" htmlFor="evidence-file">
              Ảnh bằng chứng cọc <span className="font-normal text-slate-500">(PNG/JPG/WEBP, tối đa 5 MB)</span>
            </label>
            <input
              id="evidence-file"
              type="file"
              accept={TYPES.join(',')}
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <input
              className="input"
              maxLength={500}
              placeholder="Ghi chú (không ghi SĐT / email / link)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="submit" className="btn-outline w-full" disabled={busy || !file}>
              📸 Gửi bằng chứng (DEMO)
            </button>
            {isDemo && <p className="text-xs text-slate-500">Dùng ảnh mẫu bất kỳ. Ảnh chụp màn hình không phải bằng chứng tiền đã về.</p>}
          </form>
        )}
        {(role === 'shop' || role === 'admin') && open && order.deposit_status === 'pending_verification' && canDemo && (
          <button type="button" className="btn-accent mt-3 w-full" disabled={busy} onClick={verifyDeposit}>
            🧪 Xác nhận đã nhận cọc (MÔ PHỎNG)
          </button>
        )}

        {evidence.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500">Bằng chứng cọc ({evidence.length})</p>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {evidence.map((ev) => (
                <li key={ev.id} className="relative overflow-hidden rounded-lg ring-1 ring-slate-200">
                  {urls[ev.storage_path] ? (
                    <a href={urls[ev.storage_path]} target="_blank" rel="noreferrer" title={ev.note ?? 'Bằng chứng cọc'}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls[ev.storage_path]} alt="Ảnh bằng chứng cọc" className="h-20 w-full object-cover" />
                    </a>
                  ) : (
                    <div className="h-20 bg-surface" />
                  )}
                  {ev.is_demo && (
                    <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 text-[9px] font-black uppercase tracking-wider text-amber-950">
                      Demo evidence
                    </span>
                  )}
                  <span className="block bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">
                    {ev.status === 'accepted' ? '✅ đã nhận' : ev.status === 'rejected' ? '✖️ từ chối' : '🔎 chờ'} · {timeAgo(ev.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canDispute && order.deposit_status !== 'disputed' && (
          <button type="button" className="mt-3 text-xs font-semibold text-red-700 underline" disabled={busy} onClick={() => dispute('deposit')}>
            ⚖️ Báo tranh chấp về tiền cọc
          </button>
        )}
        {role === 'admin' && open && order.status !== 'disputed' && (
          <AdminButtons disabled={busy} canVerify={canDemo && evidence.length > 0} onSet={(s) => adminSet('deposit', s)} />
        )}
      </div>

      {/* ── Điều kiện B: Phí nền tảng ── */}
      <div className="rounded-xl bg-raised p-4 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">
            <span aria-hidden>{feeOk ? '✅' : 'B.'}</span> Phí nền tảng (shop trả)
          </h3>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${fee.cls}`}>
            <span aria-hidden>{fee.icon}</span>
            {fee.label}
          </span>
        </div>
        <div className="mt-3 flex justify-between rounded-xl bg-surface px-3 py-2 text-sm">
          <span className="text-slate-500">Phí áp dụng cho đơn này{feeMode === 'demo' && ' (mô phỏng)'}</span>
          <span className="font-extrabold tabular-nums">{formatVnd(order.platform_fee_amount ?? 0)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tách riêng với tiền cọc. Tiền cọc là của shop, không phải doanh thu của Flomal.
          {order.platform_fee_verified_at && ` Ghi nhận ${timeAgo(order.platform_fee_verified_at)}.`}
        </p>
        {order.platform_fee_note && ['rejected', 'disputed'].includes(order.platform_fee_status) && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">💬 {order.platform_fee_note}</p>
        )}

        {role === 'shop' && open && ['pending', 'rejected'].includes(order.platform_fee_status) && (
          <div className="mt-3 space-y-3">
            {canDemo && feeMode === 'demo' ? (
              showFeeQr ? (
                <>
                  <PaymentQR amount={order.platform_fee_amount ?? 0} reference={`FLM${ref}`} purpose="Phí nền tảng Flomal" />
                  <p className="text-xs text-slate-500">Không xuất hoá đơn hay biên nhận. Không phải doanh thu thật.</p>
                  <button type="button" className="btn-accent w-full" disabled={busy} onClick={payFee}>
                    🧪 Mô phỏng thanh toán phí nền tảng
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary w-full" onClick={() => setShowFeeQr(true)}>
                  📱 Xem QR phí nền tảng (DEMO)
                </button>
              )
            ) : (
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                Chưa nối thanh toán thật{!demoEnabled && ' và chế độ demo đang tắt'}, nên chưa thanh toán phí được.
              </p>
            )}
          </div>
        )}
        {role === 'customer' && !feeOk && open && (
          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-slate-700">⏳ Đang chờ shop thanh toán phí nền tảng. Bạn không phải trả khoản này.</p>
        )}

        {canDispute && order.platform_fee_status !== 'disputed' && (
          <button type="button" className="mt-3 text-xs font-semibold text-red-700 underline" disabled={busy} onClick={() => dispute('platform_fee')}>
            ⚖️ Báo tranh chấp về phí nền tảng
          </button>
        )}
        {role === 'admin' && open && order.status !== 'disputed' && (
          <AdminButtons disabled={busy} canVerify={canDemo} onSet={(s) => adminSet('platform_fee', s)} />
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function AdminButtons({
  disabled,
  canVerify,
  onSet,
}: {
  disabled: boolean;
  canVerify: boolean;
  onSet: (s: 'verified_demo' | 'rejected' | 'pending') => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
      <span className="w-full text-xs font-semibold text-slate-500">Quản trị viên (có ghi nhật ký)</span>
      {canVerify && (
        <button type="button" className="btn-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => onSet('verified_demo')}>
          🧪 Xác nhận (mô phỏng)
        </button>
      )}
      <button type="button" className="btn-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => onSet('rejected')}>
        ✖️ Từ chối
      </button>
      <button type="button" className="btn-outline !px-3 !py-1.5 text-xs" disabled={disabled} onClick={() => onSet('pending')}>
        ↩️ Mở lại
      </button>
    </div>
  );
}
