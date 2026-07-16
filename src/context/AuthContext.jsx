import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient, isSupabaseConfigured } from '../utils/supabase/client';
import { ensureProfile, fetchProfile } from '../utils/supabase/profiles';

function getAuthRedirectUrl() {
  const publicUrl = process.env.PUBLIC_URL || '';
  const normalizedBase =
    !publicUrl || publicUrl === '.'
      ? ''
      : publicUrl.endsWith('/')
        ? publicUrl.slice(0, -1)
        : publicUrl;
  return `${window.location.origin}${normalizedBase}/auth`;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  const refreshProfile = useCallback(async (nextUser) => {
    if (!nextUser) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchProfile(nextUser.id);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return undefined;
    }

    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      setUser(data.session?.user ?? null);
      refreshProfile(data.session?.user ?? null).finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      refreshProfile(nextUser);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = useCallback(async (email, password) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    const nextProfile = await ensureProfile(data.user);
    setUser(data.user);
    setProfile(nextProfile);
    return { user: data.user, profile: nextProfile };
  }, []);

  const signUp = useCallback(async (email, password, role) => {
    const accountRole = role === 'store' ? 'store' : 'customer';
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: accountRole },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    if (error) {
      const message = (error.message || '').toLowerCase();
      if (
        error.code === 'user_already_exists' ||
        error.code === 'email_exists' ||
        message.includes('already registered') ||
        message.includes('already been registered') ||
        message.includes('user already exists') ||
        message.includes('email address is already')
      ) {
        const existing = new Error(
          'You already have an account with this email. Please sign in.'
        );
        existing.code = 'account_exists';
        throw existing;
      }
      throw error;
    }

    // Supabase returns a user with empty identities when the email is already registered.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const existing = new Error(
        'You already have an account with this email. Please sign in.'
      );
      existing.code = 'account_exists';
      throw existing;
    }

    if (data.session && data.user) {
      const nextProfile = await ensureProfile(data.user, accountRole);
      setUser(data.user);
      setProfile(nextProfile);
      return { user: data.user, profile: nextProfile };
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      const signInMessage = (signInError.message || '').toLowerCase();
      if (signInMessage.includes('email not confirmed')) {
        throw new Error('Check your email to confirm your account, then sign in.');
      }
      throw signInError;
    }

    const nextProfile = await ensureProfile(signInData.user, accountRole);
    setUser(signInData.user);
    setProfile(nextProfile);
    return { user: signInData.user, profile: nextProfile };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isConfigured: isSupabaseConfigured(),
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
