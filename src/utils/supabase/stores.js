import { createClient } from './client';

export async function fetchStoreByOwner(ownerId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('id, owner_id, store_name, address, email, created_at')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createStore({ ownerId, storeName, address, email }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .insert({
      owner_id: ownerId,
      store_name: storeName,
      address,
      email,
    })
    .select('id, owner_id, store_name, address, email, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateStore({ storeId, storeName, address, email }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .update({
      store_name: storeName,
      address,
      email,
    })
    .eq('id', storeId)
    .select('id, owner_id, store_name, address, email, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listStores() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('id, store_name, address, email')
    .order('store_name')
    .limit(100);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function searchStores(query) {
  const supabase = createClient();
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabase
    .from('stores')
    .select('id, store_name, address, email')
    .ilike('store_name', `%${trimmed}%`)
    .order('store_name')
    .limit(20);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchStoreById(storeId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('id, store_name, address, email')
    .eq('id', storeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
