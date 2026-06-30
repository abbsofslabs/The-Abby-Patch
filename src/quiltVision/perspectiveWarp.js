function drawImageTriangle(ctx, image, src, dst) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dst[0].x, dst[0].y);
  ctx.lineTo(dst[1].x, dst[1].y);
  ctx.lineTo(dst[2].x, dst[2].y);
  ctx.closePath();
  ctx.clip();

  const denom =
    (src[0].x - src[2].x) * (src[1].y - src[2].y) -
    (src[1].x - src[2].x) * (src[0].y - src[2].y);

  if (Math.abs(denom) < 0.001) {
    ctx.restore();
    return;
  }

  const m11 =
    ((dst[0].x - dst[2].x) * (src[1].y - src[2].y) -
      (dst[1].x - dst[2].x) * (src[0].y - src[2].y)) /
    denom;
  const m12 =
    ((dst[1].x - dst[2].x) * (src[0].x - src[2].x) -
      (dst[0].x - dst[2].x) * (src[1].x - src[2].x)) /
    denom;
  const m21 =
    ((dst[0].y - dst[2].y) * (src[1].y - src[2].y) -
      (dst[1].y - dst[2].y) * (src[0].y - src[2].y)) /
    denom;
  const m22 =
    ((dst[1].y - dst[2].y) * (src[0].x - src[2].x) -
      (dst[0].y - dst[2].y) * (src[1].x - src[2].x)) /
    denom;
  const dx = dst[2].x - m11 * src[2].x - m12 * src[2].y;
  const dy = dst[2].y - m21 * src[2].x - m22 * src[2].y;

  ctx.setTransform(m11, m21, m12, m22, dx, dy);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

export function warpCornersToRect(image, corners, outputWidth, outputHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#F5F0E6';
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const dstWidth = outputWidth;
  const dstHeight = outputHeight;

  drawImageTriangle(ctx, image, [topLeft, topRight, bottomLeft], [
    { x: 0, y: 0 },
    { x: dstWidth, y: 0 },
    { x: 0, y: dstHeight },
  ]);

  drawImageTriangle(ctx, image, [topRight, bottomRight, bottomLeft], [
    { x: dstWidth, y: 0 },
    { x: dstWidth, y: dstHeight },
    { x: 0, y: dstHeight },
  ]);

  return canvas;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function outputSizeFromCorners(corners, maxDimension = 720) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const widthEstimate = (distance(topLeft, topRight) + distance(bottomLeft, bottomRight)) / 2;
  const heightEstimate = (distance(topLeft, bottomLeft) + distance(topRight, bottomRight)) / 2;
  const aspect = widthEstimate / Math.max(heightEstimate, 1);

  if (aspect >= 1) {
    return {
      width: maxDimension,
      height: Math.max(32, Math.round(maxDimension / aspect)),
    };
  }

  return {
    width: Math.max(32, Math.round(maxDimension * aspect)),
    height: maxDimension,
  };
}

export function defaultCornersForImage(image) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const insetX = w * 0.08;
  const insetY = h * 0.08;
  return [
    { x: insetX, y: insetY },
    { x: w - insetX, y: insetY },
    { x: w - insetX, y: h - insetY },
    { x: insetX, y: h - insetY },
  ];
}

export { autoDetectCorners } from './autoDetectCorners';
