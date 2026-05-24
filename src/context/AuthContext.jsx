import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { API_BASE } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchProfile = useCallback(async (accessToken) => {
    try {
      const token =
        accessToken ||
        (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setProfile(null);
        setProfileLoaded(true);
        return null;
      }
      const res = await fetch(`${API_BASE}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setProfileLoaded(true);
        return data;
      }
      // 403 / 404 etc. — leave profile null so consent gate redirects to onboarding.
      setProfile(null);
      setProfileLoaded(true);
      return null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('fetchProfile failed:', err);
      setProfile(null);
      setProfileLoaded(true);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session: initial } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(initial);
      if (initial) {
        localStorage.setItem('sb_token', initial.access_token);
        await fetchProfile(initial.access_token);
      } else {
        setProfileLoaded(true);
      }
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        if (!mounted) return;
        setSession(sess);
        if (sess) {
          localStorage.setItem('sb_token', sess.access_token);
          fetchProfile(sess.access_token);
        } else {
          localStorage.removeItem('sb_token');
          setProfile(null);
          setProfileLoaded(true);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('sb_token');
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, profileLoaded, fetchProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
