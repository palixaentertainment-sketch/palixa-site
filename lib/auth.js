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
    const { data, error } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
    if (!error) setProfile(data || null);
  }, []);

  useEffect(() => {
    if (!configured) { setLoading(false); return undefined; }
    let alive = true;
    let currentUserId = null;
    let authEventSeen = false;

    // Subscribe first so sign-in events cannot be missed during session lookup.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      authEventSeen = true;
      const nextUser = session?.user || null;
      const nextUserId = nextUser?.id || null;

      // Token refresh does not change identity or profile; do not blank the app.
      if (event === 'TOKEN_REFRESHED' && nextUserId === currentUserId) return;

      currentUserId = nextUserId;
      setUser(nextUser);
      if (!nextUser) setProfile(null);

      // Defer Supabase profile access outside the auth callback.
      Promise.resolve().then(async () => {
        await loadProfile(nextUser);
        if (alive) setLoading(false);
      });
    });

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!alive || error) {
        if (alive) setLoading(false);
        return;
      }
      const sessionUser = data.session?.user || null;
      // Do not overwrite a newer sign-in/sign-out event received after subscribing.
      if (!authEventSeen) {
        currentUserId = sessionUser?.id || null;
        setUser(sessionUser);
        await loadProfile(sessionUser);
      }
      if (alive) setLoading(false);
    }).catch(() => {
      if (alive) setLoading(false);
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
