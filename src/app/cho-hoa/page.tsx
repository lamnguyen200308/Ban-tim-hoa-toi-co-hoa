'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import NotConfigured from '@/components/NotConfigured';
import { RequestStatusBadge } from '@/components/market/StatusBadge';
import { budgetText, formatDate, formatVnd, timeAgo } from '@/lib/format';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { RequestSummary } from '@/lib/types';

export default function MarketPage() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      let query = createClient().from('request_summaries').select('*').order('created_at', { ascending: false }).limit(60);
      if (filter === 'open') query = query.eq('status', 'open');
      if (q) query = query.ilike('title', `%${q}%`);
      const { data, error } = await query;
      if (!active) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as RequestSummary[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [filter, q]);

  if (!supabaseConfigured) return <NotConfigured />;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setQ(input.trim());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-stone-800">Chợ hoa 🛎️</h1>
          <p className="mt-1 text-stone-600">
            {profile?.role === 'shop'
              ? 'Chọn một yêu cầu và gửi báo giá cạnh tranh để chốt đơn.'
              : 'Đăng bó hoa bạn muốn — các shop sẽ báo giá, bạn chọn giá tốt nhất.'}
          </p>
        </div>
        <Link href="/cho-hoa/dang-yeu-cau" className="btn-primary">
          + Đăng yêu cầu
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-rose-100">
          {(['open', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f ? 'bg-rose-600 text-white' : 'text-stone-600'}`}
            >
              {f === 'open' ? 'Đang mở' : 'Tất cả'}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="flex flex-1 gap-2 sm:max-w-sm">
          <input className="input" placeholder="Tìm theo tiêu đề…" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn-outline !px-4" type="submit">
            Tìm
          </button>
        </form>
      </div>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lỗi tải dữ liệu: {error}</p>}

      {loading ? (
        <p className="mt-10 text-center text-stone-500">Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-5xl" aria-hidden>🌷</p>
          <p className="mt-3 font-semibold">Chưa có yêu cầu nào.</p>
          <p className="text-sm text-stone-500">Hãy là người đầu tiên đăng bó hoa bạn muốn!</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link key={r.id} href={`/cho-hoa/${r.id}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="aspect-[4/3] bg-rose-50">
                {r.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_urls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-6xl" aria-hidden>
                    💐
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <RequestStatusBadge status={r.status} />
                  <span className="text-xs text-stone-500">{timeAgo(r.created_at)}</span>
                </div>
                <h3 className="line-clamp-2 font-bold group-hover:text-rose-700">{r.title}</h3>
                <p className="text-xs text-stone-500">
                  📍 {[r.district, r.city].filter(Boolean).join(', ') || '—'} · 📅 cần {formatDate(r.needed_by)}
                </p>
                <p className="text-sm">Ngân sách: {budgetText(r.budget_min, r.budget_max)}</p>
                <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm">
                  <span>{r.bid_count} báo giá</span>
                  <span className="font-bold text-rose-700">{r.lowest_bid ? `Thấp nhất ${formatVnd(r.lowest_bid)}` : 'Chưa có giá'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
