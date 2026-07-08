import { createClient, isSupabaseConfigured } from './client';

export async function fetchProfile(userId) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, email, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfile(user, role = 'customer') {
  if (!user?.id) {
    return null;
  }

  const existing = await fetchProfile(user.id);
  if (existing) {
    return existing;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      role: user.user_metadata?.role || role,
      email: user.email || '',
    })
    .select('id, role, email, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
