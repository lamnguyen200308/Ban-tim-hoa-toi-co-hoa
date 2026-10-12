'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatVnd, timeAgo } from '@/lib/format';
import { listLocalDesigns, loadIntoDesigner, removeLocalDesign, type LocalDesign } from '@/lib/localDesigns';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { BouquetDesign } from '@/lib/types';

export default function SavedDesignsPage() {
  const router = useRouter();
  const { user, profile, loading } = useProfile();
  const [local, setLocal] = useState<LocalDesign[]>([]);
  const [account, setAccount] = useState<BouquetDesign[]>([]);

  useEffect(() => setLocal(listLocalDesigns()), []);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    createClient()
      .from('bouquet_designs')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setAccount((data ?? []) as BouquetDesign[]));
  }, [user]);

  const open = (d: LocalDesign) => {
    loadIntoDesigner(d.draft);
    router.push('/thiet-ke');
  };

  const remove = (id: string) => {
    if (!confirm('Xoá mẫu này khỏi máy?')) return;
    removeLocalDesign(id);
    setLocal(listLocalDesigns());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Mẫu đã lưu 💾</h1>
          <p className="mt-1 text-slate-600">
            {user
              ? 'Mẫu trên máy này và thiết kế trong tài khoản của bạn.'
              : 'Chưa đăng nhập: mẫu được lưu trên trình duyệt này. Đăng nhập để đăng mẫu lên Chợ hoa nhận báo giá.'}
          </p>
        </div>
        <Link href="/thiet-ke" className="btn-primary">
          🎨 Thiết kế mới
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="panel-title">Trên máy này ({local.length})</h2>
        {local.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-5xl" aria-hidden>🌷</p>
            <p className="mt-3 font-semibold">Chưa có mẫu nào.</p>
            <p className="text-sm text-slate-500">Vào Thiết kế 3D, tạo bó hoa rồi bấm “Lưu mẫu”.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {local.map((d) => (
              <li key={d.id} className="card overflow-hidden">
                {d.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumb} alt="" className="aspect-square w-full bg-slate-100 object-cover" />
                ) : (
                  <div className="grid aspect-square place-items-center bg-blue-50 text-6xl" aria-hidden>
                    💐
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <p className="truncate font-bold">{d.name}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">{d.lines.map((l) => `${l.qty} × ${l.label}`).join(' · ')}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-extrabold tabular-nums text-blue-700">{formatVnd(d.total)}</span>
                    <span className="text-xs text-slate-400">{timeAgo(d.createdAt)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" className="btn-primary flex-1 !px-3 !py-1.5 text-xs" onClick={() => open(d)}>
                      Mở & chỉnh sửa
                    </button>
                    <button type="button" className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => remove(d.id)} aria-label="Xoá mẫu">
                      🗑️
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!loading && user && profile?.role !== 'shop' && (
        <section className="mt-10">
          <h2 className="panel-title">Trong tài khoản ({account.length})</h2>
          {account.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có thiết kế nào trong tài khoản.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {account.map((d) => (
                <li key={d.id} className="card overflow-hidden">
                  {d.snapshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.snapshot_url} alt="" className="aspect-square w-full bg-slate-100 object-cover" />
                  ) : (
                    <div className="grid aspect-square place-items-center bg-blue-50 text-6xl" aria-hidden>
                      💐
                    </div>
                  )}
                  <div className="space-y-2 p-4">
                    <p className="truncate font-bold">{d.name}</p>
                    <p className="font-extrabold tabular-nums text-blue-700">{formatVnd(d.total_price)}</p>
                    <Link href={`/cho-hoa/dang-yeu-cau?design=${d.id}`} className="btn-accent w-full !py-1.5 text-xs">
                      🛎️ Đăng lên Chợ hoa
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && !user && local.length > 0 && (
        <div className="card mt-10 flex flex-wrap items-center justify-between gap-4 bg-[var(--ink)] p-6 text-white ring-0">
          <div>
            <p className="font-bold">Muốn các shop báo giá cho mẫu của bạn?</p>
            <p className="text-sm text-slate-300">Đăng nhập, mở mẫu rồi bấm “Đăng lên Chợ hoa”.</p>
          </div>
          <Link href="/dang-nhap?next=/mau-da-luu" className="btn-accent">
            Đăng nhập / Đăng ký
          </Link>
        </div>
      )}
    </div>
  );
}
