export default function NotConfigured() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="card p-6 text-center">
        <p className="text-4xl" aria-hidden>🔌</p>
        <h2 className="mt-2 text-xl font-bold">Chưa kết nối Supabase</h2>
        <p className="mt-2 text-sm text-stone-600">
          Thêm <code className="rounded bg-rose-50 px-1">NEXT_PUBLIC_SUPABASE_URL</code> và{' '}
          <code className="rounded bg-rose-50 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> vào <code>.env.local</code> (hoặc
          Environment Variables trên Vercel) rồi build lại. Xem hướng dẫn trong README.md.
        </p>
      </div>
    </div>
  );
}
