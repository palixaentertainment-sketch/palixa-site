'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, configured } from '@/lib/supabase';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u) => {
    if (!u) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    if (!configured) { setLoading(false); return undefined; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session ? data.session.user : null;
      if (!alive) return;
      setUser(u);
      await loadProfile(u);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session ? session.user : null;
      setUser(u);
      setLoading(true);
      // Defer so we never run Supabase calls inside the auth callback itself.
      setTimeout(async () => {
        await loadProfile(u);
        if (alive) setLoading(false);
      }, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const refresh = useCallback(async () => { await loadProfile(user); }, [loadProfile, user]);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
