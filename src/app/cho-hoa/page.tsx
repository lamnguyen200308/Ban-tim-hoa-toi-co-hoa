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
  const { user, profile, loading: authLoading } = useProfile();
  const [rows, setRows] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'mine'>('open');
  const [stats, setStats] = useState<{ open_total: number; quota: number } | null>(null);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    if (authLoading) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      // Database chỉ trả về số đơn bạn được phép xem (khách 3, đăng nhập 13, gói trả phí nhiều hơn)
      supabase.rpc('market_stats').then(({ data }) => {
        if (active) setStats(((data as { open_total: number; quota: number }[] | null) ?? [])[0] ?? null);
      });
      let query = supabase.from('request_summaries').select('*').order('created_at', { ascending: false }).limit(60);
      if (filter === 'open') query = query.eq('status', 'open');
      else if (profile?.role === 'shop' && user) {
        const { data: mine } = await supabase.from('bids').select('request_id').eq('shop_id', user.id);
        query = query.in('id', (mine ?? []).map((m) => m.request_id as string));
      } else if (user) query = query.eq('customer_id', user.id);
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
  }, [filter, q, authLoading, user, profile?.role]);

  if (!supabaseConfigured) return <NotConfigured />;

  const visibleOpen = rows.filter((r) => r.status === 'open').length;
  const hidden = filter === 'open' && stats ? Math.max(0, stats.open_total - visibleOpen) : 0;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setQ(input.trim());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Chợ hoa 🛎️</h1>
          <p className="mt-1 text-slate-600">
            {profile?.role === 'shop'
              ? 'Chọn một yêu cầu và gửi báo giá cạnh tranh để chốt đơn.'
              : 'Đăng bó hoa bạn muốn — các shop sẽ báo giá, bạn chọn giá tốt nhất.'}
          </p>
        </div>
        {profile?.role !== 'shop' && (
          <Link href="/cho-hoa/dang-yeu-cau" className="btn-primary">
            + Đăng yêu cầu
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-blue-100">
          {(user ? (['open', 'mine'] as const) : (['open'] as const)).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              {f === 'open' ? 'Đang mở' : profile?.role === 'shop' ? 'Đơn tôi đã báo giá' : 'Yêu cầu của tôi'}
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

      {filter === 'open' && stats && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="chip">
            Đang xem {Math.min(visibleOpen, stats.open_total)} / {stats.open_total} đơn
          </span>
          {!user ? (
            <span>
              Chưa đăng nhập: xem {stats.quota} đơn mới nhất.{' '}
              <Link href="/dang-nhap?next=/cho-hoa" className="font-semibold text-blue-700 underline">
                Đăng nhập để xem thêm 10
              </Link>
            </span>
          ) : (
            <span>Tài khoản của bạn xem được {stats.quota} đơn mới nhất.</span>
          )}
        </p>
      )}

      {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lỗi tải dữ liệu: {error}</p>}

      {loading ? (
        <p className="mt-10 text-center text-slate-500">Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-5xl" aria-hidden>🌷</p>
          <p className="mt-3 font-semibold">Chưa có yêu cầu nào.</p>
          <p className="text-sm text-slate-500">Hãy là người đầu tiên đăng bó hoa bạn muốn!</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link key={r.id} href={`/cho-hoa/${r.id}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="aspect-[4/3] bg-blue-50">
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
                  <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span>
                </div>
                <h3 className="line-clamp-2 font-bold group-hover:text-blue-700">{r.title}</h3>
                <p className="text-xs text-slate-500">
                  📍 {[r.district, r.city].filter(Boolean).join(', ') || '—'} · 📅 cần {formatDate(r.needed_by)}
                </p>
                <p className="text-sm">Ngân sách: {budgetText(r.budget_min, r.budget_max)}</p>
                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2 text-sm">
                  <span>{r.bid_count} báo giá</span>
                  <span className="font-bold text-blue-700">{r.lowest_bid ? `Thấp nhất ${formatVnd(r.lowest_bid)}` : 'Chưa có giá'}</span>
                </div>
              </div>
            </Link>
          ))}
          {filter === 'open' && !q && hidden > 0 && (
            <>
              {Array.from({ length: Math.min(hidden, 2) }).map((_, i) => (
                <div key={i} aria-hidden className="card relative hidden overflow-hidden sm:block">
                  <div className="aspect-[4/3] bg-gradient-to-br from-blue-100 to-emerald-100 blur-sm" />
                  <div className="space-y-2 p-4 blur-[3px]">
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                    <div className="h-8 rounded-xl bg-slate-100" />
                  </div>
                  <div className="absolute inset-0 grid place-items-center text-4xl">🔒</div>
                </div>
              ))}
              <LockedCard hidden={hidden} loggedIn={!!user} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LockedCard({ hidden, loggedIn }: { hidden: number; loggedIn: boolean }) {
  return (
    <div className="card flex flex-col justify-center gap-3 bg-[var(--ink)] p-6 text-white ring-0">
      <p className="text-4xl" aria-hidden>🔒</p>
      <p className="text-lg font-bold">Còn {hidden} đơn đang chờ báo giá</p>
      {loggedIn ? (
        <>
          <p className="text-sm text-slate-300">
            Bạn đã xem hết số đơn miễn phí. Gói xem thêm đơn (trả phí) sẽ sớm ra mắt.
          </p>
          <button type="button" disabled className="btn-accent">
            ⭐ Nâng cấp — sắp ra mắt
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-300">Đăng nhập để xem thêm 10 đơn nữa và gửi báo giá.</p>
          <Link href="/dang-nhap?role=shop&next=/cho-hoa" className="btn-accent">
            Đăng nhập / Đăng ký shop
          </Link>
        </>
      )}
    </div>
  );
}
