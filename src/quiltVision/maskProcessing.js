import { loadImageFromUrl } from './canvasUtils';

export async function buildLabelMapFromMaskUrls(maskUrls, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const masks = await Promise.all(maskUrls.map((url) => loadImageFromUrl(url)));

  masks.forEach((maskImage, maskIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(maskImage, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    for (let index = 0; index < width * height; index += 1) {
      if (labels[index] >= 0) {
        continue;
      }
      const alpha = data[index * 4 + 3];
      const luminance = data[index * 4];
      if (alpha > 64 || luminance > 128) {
        labels[index] = maskIndex;
      }
    }
  });

  return labels;
}
