'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

type State = { loading: boolean; user: User | null; profile: Profile | null };

/** Người dùng hiện tại + profile (role khách/shop). */
export function useProfile(): State {
  const [state, setState] = useState<State>({ loading: true, user: null, profile: null });

  useEffect(() => {
    if (!supabaseConfigured) {
      setState({ loading: false, user: null, profile: null });
      return;
    }
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let profile: Profile | null = null;
      if (user) {
        const full = await supabase.from('profiles').select('id, role, display_name, phone, is_admin').eq('id', user.id).maybeSingle();
        // Chưa chạy migration 0003 (chưa có cột is_admin) → vẫn đọc được profile
        const res = full.error
          ? await supabase.from('profiles').select('id, role, display_name, phone').eq('id', user.id).maybeSingle()
          : full;
        profile = (res.data as Profile | null) ?? null;
      }
      if (active) setState({ loading: false, user, profile });
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
