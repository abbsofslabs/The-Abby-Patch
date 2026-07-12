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

export async function updateProfileRole(userId, role) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, role, email, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfile(user, roleHint = null) {
  if (!user?.id) {
    return null;
  }

  const desiredRole = ['customer', 'store'].includes(user.user_metadata?.role)
    ? user.user_metadata.role
    : ['customer', 'store'].includes(roleHint)
      ? roleHint
      : 'customer';

  const existing = await fetchProfile(user.id);
  if (existing) {
    if (existing.role !== desiredRole && (user.user_metadata?.role || roleHint)) {
      return updateProfileRole(user.id, desiredRole);
    }
    return existing;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      role: desiredRole,
      email: user.email || '',
    })
    .select('id, role, email, created_at')
    .single();

  if (error) {
    // Profile may have been created by the DB trigger in parallel.
    const raced = await fetchProfile(user.id);
    if (raced) {
      if (raced.role !== desiredRole && (user.user_metadata?.role || roleHint)) {
        return updateProfileRole(user.id, desiredRole);
      }
      return raced;
    }
    throw error;
  }

  return data;
}
