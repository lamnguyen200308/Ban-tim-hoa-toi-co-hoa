'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errMsg, timeAgo } from '@/lib/format';
import { DEPOSIT_DECISION, DISPUTE_OUTCOME, ROLE_LABEL, canOpenDispute, type OrderRole } from '@/lib/orders';
import { createClient } from '@/lib/supabase/client';
import type { Dispute, DisputeMessage, Order } from '@/lib/types';

const BUCKET = 'dispute-evidence';
const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;

/** Khiếu nại: mở khiếu nại, hai bên gửi giải trình + ảnh bằng chứng, admin ra quyết định. */
export default function DisputePanel({
  order,
  role,
  userId,
  dispute,
  onChange,
}: {
  order: Order;
  role: OrderRole;
  userId: string;
  dispute: Dispute | null;
  onChange: () => void;
}) {
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [opening, setOpening] = useState(false);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState({ outcome: 'resume', deposit: 'none', note: '' });

  const loadMessages = useCallback(async () => {
    if (!dispute) return;
    const supabase = createClient();
    const { data } = await supabase.from('dispute_messages').select('*').eq('dispute_id', dispute.id).order('created_at');
    const list = (data ?? []) as DisputeMessage[];
    setMessages(list);
    const paths = list.flatMap((m) => m.evidence_paths);
    if (paths.length) {
      // Bucket riêng tư → tạo link tạm 1 giờ để xem ảnh
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      setUrls(map);
    }
  }, [dispute]);

  useEffect(() => {
    loadMessages();
    if (!dispute) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`dispute-${dispute.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `dispute_id=eq.${dispute.id}` }, () =>
        loadMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [dispute, loadMessages]);

  const call = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      setError(errMsg(error));
      return false;
    }
    return true;
  };

  const open = async (e: FormEvent) => {
    e.preventDefault();
    if (await call(() => createClient().rpc('open_dispute', { p_order_id: order.id, p_reason: reason }))) {
      setReason('');
      setOpening(false);
      onChange();
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!dispute || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const paths: string[] = [];
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${dispute.id}/${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        paths.push(path);
      }
      const { error } = await supabase.rpc('add_dispute_message', { p_dispute_id: dispute.id, p_body: body, p_evidence: paths });
      if (error) throw error;
      setBody('');
      setFiles([]);
      loadMessages();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (e: FormEvent) => {
    e.preventDefault();
    if (!dispute) return;
    if (!confirm('Lưu quyết định xử lý khiếu nại? Hai bên sẽ thấy quyết định và lý do.')) return;
    const ok = await call(() =>
      createClient().rpc('resolve_dispute', {
        p_dispute_id: dispute.id,
        p_outcome: decision.outcome,
        p_deposit_decision: decision.deposit,
        p_note: decision.note,
      }),
    );
    if (ok) onChange();
  };

  const showOpen = !dispute || dispute.status === 'resolved';
  if (!dispute && !canOpenDispute(order, role)) return null;

  return (
    <section className="card space-y-4 p-5" aria-labelledby="dispute-title">
      <h2 id="dispute-title" className="text-lg font-bold">⚖️ Khiếu nại</h2>

      {dispute && (
        <div className="space-y-3">
          <div className={`rounded-xl p-3 text-sm ${dispute.status === 'open' ? 'bg-red-50 text-red-900' : 'bg-slate-50 text-slate-700'}`}>
            <p className="font-semibold">
              {dispute.status === 'open' ? 'Đang xử lý' : 'Đã xử lý'} · {ROLE_LABEL[dispute.opener_role]} mở {timeAgo(dispute.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-line">{dispute.reason}</p>
          </div>

          {dispute.status === 'resolved' && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">Quyết định của quản trị viên</p>
              <p>
                {DISPUTE_OUTCOME[dispute.outcome ?? ''] ?? '—'} · {DEPOSIT_DECISION[dispute.deposit_decision ?? ''] ?? '—'}
                {order.payment_mode === 'demo' && dispute.deposit_decision !== 'none' && ' (mô phỏng, không có tiền thật)'}
              </p>
              {dispute.decision_note && <p className="mt-1 whitespace-pre-line">Lý do: {dispute.decision_note}</p>}
            </div>
          )}

          {messages.length > 0 && (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li key={m.id} className={`rounded-xl p-3 text-sm ring-1 ${m.author_role === 'admin' ? 'bg-blue-50 ring-blue-200' : 'bg-surface ring-slate-200'}`}>
                  <p className="text-xs font-semibold text-slate-500">
                    {ROLE_LABEL[m.author_role]} · {timeAgo(m.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{m.body}</p>
                  {m.evidence_paths.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.evidence_paths.map((p) =>
                        urls[p] ? (
                          <a key={p} href={urls[p]} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={urls[p]} alt="Ảnh bằng chứng" className="h-20 w-20 rounded-lg object-cover" />
                          </a>
                        ) : (
                          <span key={p} className="grid h-20 w-20 place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">ảnh</span>
                        ),
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {dispute.status === 'open' && (
            <form onSubmit={send} className="space-y-2">
              <label className="label" htmlFor="dispute-msg">
                {role === 'admin' ? 'Ghi chú / câu hỏi cho hai bên' : 'Giải trình & bằng chứng của bạn'}
              </label>
              <textarea id="dispute-msg" className="input min-h-[80px]" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/') && f.size <= MAX_SIZE);
                  setFiles(picked.slice(0, MAX_FILES));
                }}
              />
              <p className="text-xs text-slate-500">Tối đa {MAX_FILES} ảnh, mỗi ảnh 5MB. Ảnh chỉ hai bên của đơn và quản trị viên xem được.</p>
              <button type="submit" className="btn-outline" disabled={busy || !body.trim()}>
                {busy ? 'Đang gửi…' : 'Gửi'}
              </button>
            </form>
          )}

          {dispute.status === 'open' && role === 'admin' && (
            <form onSubmit={resolve} className="space-y-3 rounded-xl border-2 border-blue-200 p-3">
              <p className="font-semibold">Quyết định (quản trị viên)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="outcome">Kết quả đơn</label>
                  <select id="outcome" className="input" value={decision.outcome} onChange={(e) => setDecision((d) => ({ ...d, outcome: e.target.value }))}>
                    {Object.entries(DISPUTE_OUTCOME).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="deposit">Tiền cọc {order.payment_mode === 'demo' && '(mô phỏng)'}</label>
                  <select id="deposit" className="input" value={decision.deposit} onChange={(e) => setDecision((d) => ({ ...d, deposit: e.target.value }))}>
                    {Object.entries(DEPOSIT_DECISION).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="decision-note">Lý do quyết định *</label>
                <textarea
                  id="decision-note"
                  className="input min-h-[70px]"
                  maxLength={2000}
                  value={decision.note}
                  onChange={(e) => setDecision((d) => ({ ...d, note: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={busy || decision.note.trim().length < 5}>
                Lưu quyết định
              </button>
            </form>
          )}
        </div>
      )}

      {showOpen && canOpenDispute(order, role) &&
        (opening ? (
          <form onSubmit={open} className="space-y-2">
            <label className="label" htmlFor="reason">Vấn đề bạn gặp phải *</label>
            <textarea
              id="reason"
              className="input min-h-[90px]"
              maxLength={2000}
              placeholder="Mô tả cụ thể: hoa sai mẫu, giao trễ, không liên lạc được… Bạn gửi thêm ảnh bằng chứng sau khi mở khiếu nại."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Quản trị viên sẽ xem lịch sử đơn, báo giá đã chốt và giải trình của cả hai bên trước khi quyết định. Không ai bị phạt tự động.
            </p>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={busy || reason.trim().length < 5}>
                Gửi khiếu nại
              </button>
              <button type="button" className="btn-outline" onClick={() => setOpening(false)}>
                Huỷ
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-outline" onClick={() => setOpening(true)}>
            ⚖️ Mở khiếu nại
          </button>
        ))}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
