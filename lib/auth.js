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

    // Subscribe first so a sign-in that happens during getSession is not missed.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user || null;
      const nextUserId = nextUser?.id || null;

      // Token refreshes do not change identity or profile. Avoid an unnecessary
      // profile query and, importantly, never put the whole app back into loading.
      if (event === 'TOKEN_REFRESHED' && nextUserId === currentUserId) return;

      currentUserId = nextUserId;
      setUser(nextUser);
      if (!nextUser) setProfile(null);

      // Only the first session resolution controls the global loading state.
      // Subsequent auth changes update the header/profile without blanking the app.
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
      // Do not overwrite a newer sign-in/sign-out event received after subscription.
      if (currentUserId === null) {
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
