/**
 * Fabric motif helpers: crop a repeat from a photo, sample color,
 * and compute CSS tiling so the print scales correctly on the quilt grid.
 */

/** Sample a pixel color from an image element at client coords inside it. */
export function sampleImageColor(img, clientX, clientY) {
  if (!img?.naturalWidth) {
    return null;
  }

  const rect = img.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = Math.min(
    img.naturalWidth - 1,
    Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * img.naturalWidth))
  );
  const y = Math.min(
    img.naturalHeight - 1,
    Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * img.naturalHeight))
  );

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return rgbToHex(r, g, b);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/**
 * Crop a natural-pixel rectangle from an image into a JPEG/PNG blob.
 * rect uses display-space ratios (0–1) relative to the visible image box.
 */
export async function cropImageToBlob(img, rect, type = 'image/jpeg', quality = 0.92) {
  if (!img?.naturalWidth || !rect) {
    throw new Error('Image and crop rectangle are required.');
  }

  const x = Math.max(0, Math.floor(rect.x * img.naturalWidth));
  const y = Math.max(0, Math.floor(rect.y * img.naturalHeight));
  const w = Math.max(1, Math.floor(rect.w * img.naturalWidth));
  const h = Math.max(1, Math.floor(rect.h * img.naturalHeight));
  const width = Math.min(w, img.naturalWidth - x);
  const height = Math.min(h, img.naturalHeight - y);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Could not crop fabric image.'));
        }
      },
      type,
      quality
    );
  });

  return blob;
}

/**
 * CSS background for one quilt cell so a motif of motifW×motifH inches
 * tiles across the quilt. Origin is the top-left of the grid (top-left crop
 * when the cell is smaller than the motif).
 *
 * Returns null when the fabric has no usable motif metadata (caller uses solid color).
 */
export function getFabricTileStyle(fabric, blockSizeInches, col, row) {
  const imageUrl = fabric?.imageUrl;
  const motifW = Number(fabric?.motifWidthIn);
  const motifH = Number(fabric?.motifHeightIn);
  const block = Number(blockSizeInches);

  if (!imageUrl || !(motifW > 0) || !(motifH > 0) || !(block > 0)) {
    return null;
  }

  const inchX = col * block;
  const inchY = row * block;
  const offsetX = ((inchX % motifW) + motifW) % motifW;
  const offsetY = ((inchY % motifH) + motifH) % motifH;

  return {
    backgroundImage: `url(${JSON.stringify(imageUrl).slice(1, -1)})`,
    backgroundRepeat: 'repeat',
    backgroundSize: `${(motifW / block) * 100}% ${(motifH / block) * 100}%`,
    backgroundPosition: `${(-offsetX / block) * 100}% ${(-offsetY / block) * 100}%`,
  };
}

/** Preview a 12″ square with the motif tiled (for store upload). */
export function getFabricPreviewStyle(fabricOrMotif, previewInches = 12) {
  const imageUrl = fabricOrMotif?.imageUrl || fabricOrMotif?.previewUrl;
  const motifW = Number(fabricOrMotif?.motifWidthIn);
  const motifH = Number(fabricOrMotif?.motifHeightIn);
  const size = Number(previewInches) || 12;

  if (!imageUrl || !(motifW > 0) || !(motifH > 0)) {
    return {
      backgroundColor: fabricOrMotif?.primaryColor || '#C4898C',
    };
  }

  return {
    backgroundImage: `url(${JSON.stringify(imageUrl).slice(1, -1)})`,
    backgroundRepeat: 'repeat',
    backgroundSize: `${(motifW / size) * 100}% ${(motifH / size) * 100}%`,
    backgroundPosition: '0% 0%',
  };
}

export function fabricHasMotifTile(fabric) {
  return Boolean(
    fabric?.imageUrl &&
      Number(fabric?.motifWidthIn) > 0 &&
      Number(fabric?.motifHeightIn) > 0
  );
}
