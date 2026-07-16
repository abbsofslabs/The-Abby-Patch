import { createClient, isSupabaseConfigured } from './client';
import { buildDesignPayload, getDesignPreviewMeta } from '../designPayload';

function mapDesignRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    payload: row.payload,
    quiltWidth: row.quilt_width != null ? Number(row.quilt_width) : null,
    quiltHeight: row.quilt_height != null ? Number(row.quilt_height) : null,
    previewColors: Array.isArray(row.preview_colors) ? row.preview_colors : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSavedDesigns(userId) {
  if (!isSupabaseConfigured() || !userId) {
    return [];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('saved_designs')
    .select(
      'id, user_id, name, payload, quilt_width, quilt_height, preview_colors, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDesignRow);
}

export async function getSavedDesign(designId) {
  if (!isSupabaseConfigured() || !designId) {
    return null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('saved_designs')
    .select(
      'id, user_id, name, payload, quilt_width, quilt_height, preview_colors, created_at, updated_at'
    )
    .eq('id', designId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapDesignRow(data);
}

export async function createSavedDesign({ userId, name, designState }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud saves are not configured.');
  }
  if (!userId) {
    throw new Error('You must be signed in to save a design.');
  }

  const payload = buildDesignPayload(designState);
  const meta = getDesignPreviewMeta(payload);
  const supabase = createClient();

  const { data, error } = await supabase
    .from('saved_designs')
    .insert({
      user_id: userId,
      name: (name || 'Untitled quilt').trim() || 'Untitled quilt',
      payload,
      quilt_width: meta.quiltWidth,
      quilt_height: meta.quiltHeight,
      preview_colors: meta.previewColors,
    })
    .select(
      'id, user_id, name, payload, quilt_width, quilt_height, preview_colors, created_at, updated_at'
    )
    .single();

  if (error) {
    throw error;
  }

  return mapDesignRow(data);
}

export async function updateSavedDesign({ designId, name, designState }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud saves are not configured.');
  }
  if (!designId) {
    throw new Error('Missing design id.');
  }

  const updates = {};
  if (typeof name === 'string') {
    updates.name = name.trim() || 'Untitled quilt';
  }
  if (designState) {
    const payload = buildDesignPayload(designState);
    const meta = getDesignPreviewMeta(payload);
    updates.payload = payload;
    updates.quilt_width = meta.quiltWidth;
    updates.quilt_height = meta.quiltHeight;
    updates.preview_colors = meta.previewColors;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('saved_designs')
    .update(updates)
    .eq('id', designId)
    .select(
      'id, user_id, name, payload, quilt_width, quilt_height, preview_colors, created_at, updated_at'
    )
    .single();

  if (error) {
    throw error;
  }

  return mapDesignRow(data);
}

export async function renameSavedDesign(designId, name) {
  return updateSavedDesign({ designId, name });
}

export async function deleteSavedDesign(designId) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud saves are not configured.');
  }
  if (!designId) {
    throw new Error('Missing design id.');
  }

  const supabase = createClient();
  const { error } = await supabase.from('saved_designs').delete().eq('id', designId);

  if (error) {
    throw error;
  }
}
