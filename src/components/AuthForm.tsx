'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import NotConfigured from '@/components/NotConfigured';
import { errMsg, safeNext } from '@/lib/format';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

export default function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('role') === 'shop' ? 'signup' : 'login');
  const [role, setRole] = useState<Role>(params.get('role') === 'shop' ? 'shop' : 'customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [district, setDistrict] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!supabaseConfigured) return <NotConfigured />;

  const done = () => {
    router.push(next);
    router.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        done();
        return;
      }
      if (password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.');
      if (role === 'shop' && !shopName.trim()) throw new Error('Vui lòng nhập tên shop.');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: {
            role,
            display_name: displayName.trim() || null,
            phone: phone.trim() || null,
            shop_name: role === 'shop' ? shopName.trim() : null,
            district: role === 'shop' ? district.trim() || null : null,
          },
        },
      });
      if (error) throw error;
      if (data.session) done();
      else setInfo('Đã gửi email xác nhận 💌 Hãy mở hộp thư và bấm vào đường link để kích hoạt tài khoản.');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <div className="mb-6 flex rounded-full bg-blue-50 p-1">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
            >
              {m === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['customer', '💝', 'Tôi mua hoa'],
                  ['shop', '🏪', 'Tôi là shop hoa'],
                ] as const
              ).map(([r, icon, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border p-3 text-sm font-semibold transition ${role === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-100 text-slate-600'}`}
                >
                  <span className="block text-2xl" aria-hidden>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'signup' && (
            <>
              <div>
                <label className="label" htmlFor="name">Tên hiển thị</label>
                <input id="name" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Số điện thoại</label>
                <input id="phone" type="tel" className="input" placeholder="Chỉ hiện cho đối tác sau khi chốt đơn" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {role === 'shop' && (
                <>
                  <div>
                    <label className="label" htmlFor="shop">Tên shop *</label>
                    <input id="shop" className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="district">Quận / huyện</label>
                    <input id="district" className="input" placeholder="VD: Quận 1" value={district} onChange={(e) => setDistrict(e.target.value)} />
                  </div>
                </>
              )}
            </>
          )}

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {info && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{info}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>
      </div>
    </div>
  );
}
