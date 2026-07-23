import { createClient } from './client';

const FABRIC_COLUMNS =
  'id, store_id, name, image_url, price_per_yard, primary_color, motif_width_in, motif_height_in, created_at';

export async function fetchFabricsForStore(storeId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fabrics')
    .select(FABRIC_COLUMNS)
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
  motifWidthIn = null,
  motifHeightIn = null,
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
      motif_width_in: motifWidthIn,
      motif_height_in: motifHeightIn,
    })
    .select(FABRIC_COLUMNS)
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
    .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });

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

  const motifWidthIn =
    row.motif_width_in != null ? Number(row.motif_width_in) : null;
  const motifHeightIn =
    row.motif_height_in != null ? Number(row.motif_height_in) : null;

  return {
    id: row.id,
    storeId: row.store_id,
    storeName,
    name: row.name,
    imageUrl: row.image_url,
    pricePerYard: Number(row.price_per_yard),
    primaryColor: row.primary_color,
    motifWidthIn: Number.isFinite(motifWidthIn) && motifWidthIn > 0 ? motifWidthIn : null,
    motifHeightIn: Number.isFinite(motifHeightIn) && motifHeightIn > 0 ? motifHeightIn : null,
  };
}
