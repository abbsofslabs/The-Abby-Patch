import { createClient } from './client';

export async function fetchFabricsForStore(storeId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fabrics')
    .select('id, store_id, name, image_url, price_per_yard, primary_color, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createFabric({
  storeId,
  name,
  imageUrl,
  pricePerYard,
  primaryColor,
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fabrics')
    .insert({
      store_id: storeId,
      name,
      image_url: imageUrl,
      price_per_yard: pricePerYard,
      primary_color: primaryColor,
    })
    .select('id, store_id, name, image_url, price_per_yard, primary_color, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function uploadFabricImage(ownerId, file) {
  const supabase = createClient();
  const extension = file.name.split('.').pop() || 'jpg';
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('fabric-images')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('fabric-images').getPublicUrl(path);
  return data.publicUrl;
}

export function mapFabricRow(row, storeName = '') {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    storeId: row.store_id,
    storeName,
    name: row.name,
    imageUrl: row.image_url,
    pricePerYard: Number(row.price_per_yard),
    primaryColor: row.primary_color,
  };
}
