/**
 * Serialize / restore a full designer session for cloud saves.
 */

function collectPreviewColors(sides, limit = 6) {
  const seen = new Set();
  const colors = [];

  const push = (color) => {
    if (!color) {
      return;
    }
    const key = color.toLowerCase();
    if (seen.has(key) || colors.length >= limit) {
      return;
    }
    seen.add(key);
    colors.push(key);
  };

  ['front', 'back'].forEach((sideId) => {
    const side = sides?.[sideId];
    side?.cellColors?.forEach(push);
    side?.cellColorsB?.forEach(push);
  });

  return colors;
}

export function buildDesignPayload({
  grid,
  sides,
  quiltWidth,
  quiltHeight,
  blockSize,
  quiltSizePreset,
  activeSide,
  boltWidth,
  seamAllowance,
  fabricCatalog = {},
}) {
  return {
    version: 1,
    grid,
    sides,
    quiltWidth,
    quiltHeight,
    blockSize,
    quiltSizePreset,
    activeSide,
    boltWidth,
    seamAllowance,
    fabricCatalog,
  };
}

export function getDesignPreviewMeta(payload) {
  const grid = payload?.grid;
  return {
    quiltWidth: Number(payload?.quiltWidth) || grid?.finishedWidth || null,
    quiltHeight: Number(payload?.quiltHeight) || grid?.finishedHeight || null,
    previewColors: collectPreviewColors(payload?.sides),
  };
}

export function designHasColoredBlocks(payload) {
  const sides = payload?.sides;
  if (!sides) {
    return false;
  }
  return ['front', 'back'].some((sideId) => {
    const side = sides[sideId];
    return (
      side?.cellColors?.some(Boolean) ||
      side?.cellColorsB?.some(Boolean)
    );
  });
}
