'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { LOCAL_CATALOGUE, RIBBON_COLOURS, loadCatalogue } from '@/lib/catalogue';
import { MAX_STEMS, computePrice } from '@/lib/pricing';
import { errMsg, formatVnd } from '@/lib/format';
import { DRAFT_KEY, addLocalDesign, thumbnailFrom, type Draft } from '@/lib/localDesigns';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import type { BouquetItem, Catalogue, Flower, FlowerPositions, HeadPos } from '@/lib/types';

const BouquetCanvas = dynamic(() => import('./BouquetCanvas'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-slate-400">Đang dựng khung 3D…</div>,
});

const DRAG_PREFIX = 'flower:';

const NUDGE = 0.06;

/** Tách khoá `${flowerId}#${thứ tự}`. */
function splitKey(key: string): [string, number] {
  const i = key.lastIndexOf('#');
  return [key.slice(0, i), Number(key.slice(i + 1))];
}

function isHeadPos(v: unknown): v is HeadPos {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** Bỏ bông thứ `k` của một loại hoa: các bông phía sau lùi số thứ tự, giữ nguyên vị trí đã đặt. */
function shiftPositions(prev: FlowerPositions, flowerId: string, k: number): FlowerPositions {
  const next: FlowerPositions = {};
  for (const [key, pos] of Object.entries(prev)) {
    const [id, j] = splitKey(key);
    if (id !== flowerId || j < k) next[key] = pos;
    else if (j > k) next[`${id}#${j - 1}`] = pos;
  }
  return next;
}

function FlowerSwatch({ flower }: { flower: Flower }) {
  return (
    <span
      aria-hidden
      className="h-9 w-9 shrink-0 rounded-full ring-1 ring-slate-200"
      style={{ background: `radial-gradient(circle at 50% 50%, ${flower.accent_color} 0 26%, ${flower.color} 30% 100%)` }}
    />
  );
}

export default function Customiser() {
  const router = useRouter();
  const { user: signedIn } = useProfile();
  const [catalogue, setCatalogue] = useState<Catalogue>(LOCAL_CATALOGUE);
  const [source, setSource] = useState<'local' | 'supabase'>('local');
  const [items, setItems] = useState<BouquetItem[]>([]);
  const [wrapperId, setWrapperId] = useState(LOCAL_CATALOGUE.wrappers[0].id);
  const [styleId, setStyleId] = useState(LOCAL_CATALOGUE.styles[0].id);
  const [ribbon, setRibbon] = useState(RIBBON_COLOURS[0].value);
  const [autoRotate, setAutoRotate] = useState(true);
  const [positions, setPositions] = useState<FlowerPositions>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    loadCatalogue().then(({ catalogue, source }) => {
      setCatalogue(catalogue);
      setSource(source);
    });
  }, []);

  // Khôi phục bản nháp (giữ thiết kế khi phải đăng nhập giữa chừng)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        if (Array.isArray(d.items)) setItems(d.items.filter((i) => i && typeof i.flowerId === 'string' && i.qty > 0));
        if (d.wrapperId) setWrapperId(d.wrapperId);
        if (d.styleId) setStyleId(d.styleId);
        if (d.ribbon) setRibbon(d.ribbon);
        if (d.positions && typeof d.positions === 'object') {
          setPositions(Object.fromEntries(Object.entries(d.positions).filter(([k, v]) => k.includes('#') && isHeadPos(v))));
        }
      }
    } catch {
      /* bộ nhớ trình duyệt không dùng được — bỏ qua */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ items, wrapperId, styleId, ribbon, positions } satisfies Draft));
    } catch {
      /* bỏ qua */
    }
  }, [hydrated, items, wrapperId, styleId, ribbon, positions]);

  const price = useMemo(() => computePrice(items, catalogue, wrapperId, styleId), [items, catalogue, wrapperId, styleId]);

  const addFlower = (id: string) => {
    setNotice(null);
    if (price.stems >= MAX_STEMS) {
      setNotice(`Bó hoa tối đa ${MAX_STEMS} cành nhé.`);
      return;
    }
    setItems((prev) =>
      prev.some((i) => i.flowerId === id)
        ? prev.map((i) => (i.flowerId === id ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { flowerId: id, qty: 1 }],
    );
  };

  /** Bỏ đúng bông thứ `k` của loại hoa `id` (mặc định: bông cuối). */
  const removeOne = (id: string, k?: number) => {
    const qty = items.find((i) => i.flowerId === id)?.qty ?? 0;
    if (!qty) return;
    const idx = k ?? qty - 1;
    setItems((prev) => prev.map((i) => (i.flowerId === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0));
    setPositions((prev) => shiftPositions(prev, id, idx));
    setSelected((cur) => {
      if (!cur) return cur;
      const [sid, sk] = splitKey(cur);
      if (sid !== id || sk < idx) return cur;
      return sk === idx ? null : `${sid}#${sk - 1}`;
    });
  };

  const changeQty = (id: string, delta: number) => {
    if (delta > 0) return addFlower(id);
    removeOne(id);
  };

  const selectFlower = (key: string | null) => {
    setSelected(key);
    if (key) setAutoRotate(false); // dừng xoay để dễ chỉnh
  };

  const moveFlower = (key: string, pos: HeadPos) => setPositions((prev) => ({ ...prev, [key]: pos }));

  const nudgeSelected = (dy: number) => {
    if (!selected) return;
    const base = positions[selected] ?? currentHead.current?.(selected);
    if (!base) return;
    moveFlower(selected, [base[0], Math.min(1.45, Math.max(0.3, base[1] + dy)), base[2]]);
  };

  const resetSelected = () => {
    if (!selected) return;
    setPositions(({ [selected]: _removed, ...rest }) => rest);
  };

  const currentHead = useRef<((key: string) => HeadPos | undefined) | null>(null);
  const selectedFlower = selected ? catalogue.flowers.find((f) => f.id === splitKey(selected)[0]) : undefined;
  const hasCustom = Object.keys(positions).length > 0;

  /** Ẩn vòng chọn trước khi chụp ảnh bó hoa. */
  const hideSelection = async () => {
    if (!selected) return;
    setSelected(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
    const data = e.dataTransfer.getData('text/plain');
    if (!data.startsWith(DRAG_PREFIX)) return;
    const id = data.slice(DRAG_PREFIX.length);
    if (catalogue.flowers.some((f) => f.id === id)) addFlower(id);
  };

  const snapshotBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const c = canvasEl.current;
      if (!c) return resolve(null);
      c.toBlob((b) => resolve(b), 'image/png');
    });

  const downloadImage = async () => {
    await hideSelection();
    const c = canvasEl.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'bo-hoa-cua-toi.png';
    a.click();
  };

  /** Khách chưa đăng nhập: lưu mẫu ngay trên trình duyệt này. */
  async function saveLocal() {
    await hideSelection();
    const top = [...price.lines].sort((a, b) => b.qty - a.qty)[0];
    try {
      addLocalDesign({
        name: `${top.label} ${price.stems} cành`,
        total: price.total,
        stems: price.stems,
        lines: price.lines.map((l) => ({ label: l.label, qty: l.qty })),
        thumb: thumbnailFrom(canvasEl.current),
        draft: { items, wrapperId, styleId, ribbon, positions },
      });
      setNotice('Đã lưu mẫu trên máy này 💾 — xem ở tab “Mẫu đã lưu”. Đăng nhập để lưu vào tài khoản và đăng lên Chợ hoa.');
    } catch {
      setNotice('Trình duyệt không cho lưu (bộ nhớ đầy hoặc đang ở chế độ ẩn danh). Bạn vẫn có thể tải ảnh bó hoa.');
    }
  }

  async function saveDesign(thenPost: boolean) {
    setNotice(null);
    if (!price.lines.length) {
      setNotice('Hãy thêm ít nhất một bông hoa vào bó.');
      return;
    }
    if (!supabaseConfigured) {
      if (!thenPost) return saveLocal();
      setNotice('Chưa kết nối Supabase (xem README). Bạn vẫn có thể lưu mẫu và tải ảnh bó hoa.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Chưa đăng nhập: chỉ được thiết kế và lưu mẫu trên máy
        if (thenPost) router.push('/dang-nhap?next=/thiet-ke');
        else await saveLocal();
        return;
      }

      let snapshot_url: string | null = null;
      await hideSelection();
      const blob = await snapshotBlob();
      if (blob) {
        const path = `${user.id}/designs/${crypto.randomUUID()}.png`;
        const up = await supabase.storage.from('request-images').upload(path, blob, { contentType: 'image/png' });
        if (!up.error) snapshot_url = supabase.storage.from('request-images').getPublicUrl(path).data.publicUrl;
      }

      const top = [...price.lines].sort((a, b) => b.qty - a.qty)[0];
      const { data, error } = await supabase
        .from('bouquet_designs')
        .insert({
          customer_id: user.id,
          name: `${top.label} ${price.stems} cành`,
          wrapper_id: price.wrapper?.id ?? null,
          wrapper_name: price.wrapper?.name ?? null,
          style_id: price.style?.id ?? null,
          style_name: price.style?.name ?? null,
          ribbon_color: ribbon,
          items: price.lines.map((l) => ({ flowerId: l.id, name: l.label, qty: l.qty, price: l.unit })),
          total_price: price.total,
          snapshot_url,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (thenPost) router.push(`/cho-hoa/dang-yeu-cau?design=${data.id}`);
      else setNotice('Đã lưu thiết kế vào tài khoản của bạn ✨');
    } catch (e) {
      setNotice('Không lưu được: ' + errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Thiết kế bó hoa của bạn</h1>
          <p className="text-sm text-slate-500">
            Kéo hoa vào khung 3D (hoặc bấm +), kéo nền để xoay ngắm mọi góc. Bấm vào một bông rồi kéo để đổi vị trí.
            Giá cập nhật ngay khi bạn thay đổi.
          </p>
        </div>
        {source === 'local' && <span className="chip">Đang dùng bảng giá mẫu</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_330px]">
        {/* Danh sách hoa */}
        <aside className="card p-3 lg:max-h-[640px] lg:overflow-y-auto">
          <h2 className="panel-title px-1">Chọn hoa</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {catalogue.flowers.map((f) => (
              <li
                key={f.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', DRAG_PREFIX + f.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="flex cursor-grab items-center gap-2 rounded-xl border border-blue-100 bg-white p-2 transition hover:border-blue-300 active:cursor-grabbing"
              >
                <FlowerSwatch flower={f} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.name}</p>
                  <p className="text-xs text-slate-500">{formatVnd(f.price)}/cành</p>
                </div>
                <button
                  type="button"
                  onClick={() => addFlower(f.id)}
                  aria-label={`Thêm ${f.name}`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Khung 3D */}
        <section
          className={`card relative h-[460px] overflow-hidden sm:h-[560px] lg:h-[640px] ${dragOver ? 'ring-4 ring-blue-300' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
          }}
          onDrop={onDrop}
        >
          <BouquetCanvas
            catalogue={catalogue}
            items={items}
            wrapper={price.wrapper}
            style={price.style}
            ribbon={ribbon}
            autoRotate={autoRotate}
            onCanvas={(el) => {
              canvasEl.current = el;
            }}
            positions={positions}
            selectedKey={selected}
            onSelect={selectFlower}
            onMove={moveFlower}
            headOf={(fn) => {
              currentHead.current = fn;
            }}
          />
          {selected && selectedFlower && (
            <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-2 text-xs shadow-sm ring-1 ring-blue-100">
              <span className="px-1 font-semibold text-slate-700">
                ✋ {selectedFlower.name} — kéo để di chuyển
              </span>
              <span className="flex-1" />
              <button type="button" className="btn-outline !px-2.5 !py-1 text-xs" onClick={() => nudgeSelected(NUDGE)} aria-label="Nâng bông hoa lên">
                ↑ Nâng
              </button>
              <button type="button" className="btn-outline !px-2.5 !py-1 text-xs" onClick={() => nudgeSelected(-NUDGE)} aria-label="Hạ bông hoa xuống">
                ↓ Hạ
              </button>
              {positions[selected] && (
                <button type="button" className="btn-outline !px-2.5 !py-1 text-xs" onClick={resetSelected}>
                  ↺ Vị trí gốc
                </button>
              )}
              <button
                type="button"
                className="btn-outline !px-2.5 !py-1 text-xs"
                onClick={() => {
                  const [id, k] = splitKey(selected);
                  removeOne(id, k);
                }}
              >
                🗑 Bỏ bông này
              </button>
              <button type="button" className="btn-primary !px-3 !py-1 text-xs" onClick={() => setSelected(null)}>
                ✓ Xong
              </button>
            </div>
          )}
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-blue-50/60 text-lg font-bold text-blue-700">
              Thả vào để thêm hoa 🌷
            </div>
          )}
          {items.length > 0 && !selected && !dragOver && (
            <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs text-slate-400">
              Mẹo: bấm vào một bông hoa để chọn và kéo đổi vị trí
            </div>
          )}
          {!items.length && !dragOver && (
            <div className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-slate-500">
              Bó hoa đang trống — kéo một bông hoa vào đây
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <button type="button" className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => setAutoRotate((v) => !v)}>
              {autoRotate ? '⏸ Dừng xoay' : '⟳ Tự xoay'}
            </button>
            <button type="button" className="btn-outline !px-3 !py-1.5 text-xs" onClick={downloadImage}>
              ⬇ Tải ảnh
            </button>
            {hasCustom && (
              <button
                type="button"
                className="btn-outline !px-3 !py-1.5 text-xs"
                onClick={() => {
                  setPositions({});
                  setSelected(null);
                }}
              >
                ✨ Tự xếp lại
              </button>
            )}
          </div>
          <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500 ring-1 ring-blue-100">
            {price.stems}/{MAX_STEMS} cành
          </div>
        </section>

        {/* Tuỳ chọn + giá */}
        <aside className="flex flex-col gap-4">
          <div className="card space-y-4 p-4">
            <div>
              <h3 className="panel-title">Giấy gói</h3>
              <div className="grid grid-cols-3 gap-2">
                {catalogue.wrappers.map((w) => (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => setWrapperId(w.id)}
                    className={`rounded-xl border p-2 text-left transition ${
                      price.wrapper?.id === w.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-100 hover:border-blue-300'
                    }`}
                  >
                    <span
                      className="mb-1 block h-7 rounded-lg ring-1 ring-black/10"
                      style={{ background: w.color, opacity: Math.max(w.opacity, 0.5) }}
                    />
                    <span className="block text-[11px] font-medium leading-tight">{w.name}</span>
                    <span className="block text-[11px] text-slate-500">{formatVnd(w.price)}/tờ</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="panel-title">Kiểu gói</h3>
              <div className="space-y-2">
                {catalogue.styles.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setStyleId(s.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                      price.style?.id === s.id ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-200' : 'border-blue-100 hover:border-blue-300'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{s.name}</span>
                      {s.description && <span className="block text-xs text-slate-500">{s.description}</span>}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-blue-700">+{formatVnd(s.fee)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="panel-title">Ruy băng</h3>
              <div className="flex flex-wrap gap-2">
                {RIBBON_COLOURS.map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => setRibbon(c.value)}
                    className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${ribbon === c.value ? 'ring-blue-500' : 'ring-transparent'}`}
                    style={{ background: c.value, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="panel-title !mb-0">Bó hoa của bạn</h3>
              {items.length > 0 && (
                <button type="button" className="text-xs text-slate-500 hover:text-blue-700" onClick={() => {
                    setItems([]);
                    setPositions({});
                    setSelected(null);
                  }}
                >
                  Xóa hết
                </button>
              )}
            </div>

            {price.lines.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Chưa có hoa nào.</p>
            ) : (
              <ul className="mt-2 divide-y divide-blue-50">
                {price.lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Bớt ${l.label}`}
                        onClick={() => changeQty(l.id, -1)}
                        className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums">{l.qty}</span>
                      <button
                        type="button"
                        aria-label={`Thêm ${l.label}`}
                        onClick={() => changeQty(l.id, 1)}
                        className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-24 text-right tabular-nums">{formatVnd(l.total)}</span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-3 space-y-1 border-t border-dashed border-blue-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Hoa ({price.stems} cành)</dt>
                <dd className="tabular-nums">{formatVnd(price.flowersTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">
                  {price.wrapper?.name ?? 'Giấy gói'} × {price.sheets} tờ
                </dt>
                <dd className="tabular-nums">{formatVnd(price.wrapperTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Công gói ({price.style?.name})</dt>
                <dd className="tabular-nums">{formatVnd(price.styleFee)}</dd>
              </div>
            </dl>

            <div className="mt-3 flex items-end justify-between">
              <span className="text-sm font-semibold text-slate-600">Tổng tạm tính</span>
              <span key={price.total} className="inline-block animate-pop text-2xl font-extrabold tabular-nums text-blue-700">
                {formatVnd(price.total)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Giá tham khảo. Đăng lên Chợ hoa để các shop cạnh tranh báo giá tốt hơn.
            </p>

            <div className="mt-4 grid gap-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => saveDesign(true)}>
                🛎️ Đăng lên Chợ hoa để nhận báo giá
              </button>
              <button type="button" className="btn-outline" disabled={busy} onClick={() => saveDesign(false)}>
                💾 {signedIn ? 'Lưu thiết kế vào tài khoản' : 'Lưu mẫu (trên máy này)'}
              </button>
              {!signedIn && (
                <p className="text-center text-[11px] text-slate-500">
                  Chưa đăng nhập: bạn có thể thiết kế và lưu mẫu.{' '}
                  <Link href="/mau-da-luu" className="font-semibold text-blue-700 underline">
                    Xem mẫu đã lưu
                  </Link>
                </p>
              )}
            </div>
            {notice && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
