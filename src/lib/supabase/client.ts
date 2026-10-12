import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true khi đã khai báo biến môi trường Supabase. */
export const supabaseConfigured = Boolean(url && anonKey);

/** Supabase client cho trình duyệt (singleton do @supabase/ssr quản lý). */
export function createClient() {
  if (!url || !anonKey) {
    throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createBrowserClient(url, anonKey);
}
