function grayscale(data, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i += 1) {
    const index = i * 4;
    gray[i] =
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }
  return gray;
}

function sobelMagnitude(gray, width, height) {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -gray[index - width - 1] +
        gray[index - width + 1] +
        -2 * gray[index - 1] +
        2 * gray[index + 1] +
        -gray[index + width - 1] +
        gray[index + width + 1];
      const gy =
        -gray[index - width - 1] -
        2 * gray[index - width] -
        gray[index - width + 1] +
        gray[index + width - 1] +
        2 * gray[index + width] +
        gray[index + width + 1];
      mag[index] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function orderCorners(points) {
  const topLeft = points.reduce((best, point) =>
    point.x + point.y < best.x + best.y ? point : best
  );
  const bottomRight = points.reduce((best, point) =>
    point.x + point.y > best.x + best.y ? point : best
  );
  const topRight = points.reduce((best, point) =>
    point.x - point.y > best.x - best.y ? point : best
  );
  const bottomLeft = points.reduce((best, point) =>
    point.y - point.x > best.y - best.x ? point : best
  );
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function quadArea(corners) {
  const [a, b, c, d] = corners;
  return (
    Math.abs(
      a.x * b.y -
        b.x * a.y +
        b.x * c.y -
        c.x * b.y +
        c.x * d.y -
        d.x * c.y +
        d.x * a.y -
        a.x * d.y
    ) / 2
  );
}

function cornersFromEdges(edgePoints, width, height) {
  if (edgePoints.length < 20) {
    return null;
  }

  const center = edgePoints.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  center.x /= edgePoints.length;
  center.y /= edgePoints.length;

  const quadrants = [[], [], [], []];
  edgePoints.forEach((point) => {
    const right = point.x >= center.x;
    const bottom = point.y >= center.y;
    const quadrant = (bottom ? 2 : 0) + (right ? 1 : 0);
    quadrants[quadrant].push(point);
  });

  const picks = quadrants.map((points) => {
    if (!points.length) {
      return null;
    }
    return points.reduce((best, point) => {
      const bestDistance = (best.x - center.x) ** 2 + (best.y - center.y) ** 2;
      const pointDistance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      return pointDistance > bestDistance ? point : best;
    });
  });

  if (picks.some((point) => !point)) {
    return null;
  }

  const ordered = orderCorners(picks);
  const area = quadArea(ordered);
  const imageArea = width * height;
  if (area < imageArea * 0.12 || area > imageArea * 0.98) {
    return null;
  }

  return ordered;
}

function fullImageCorners(width, height) {
  const insetX = width * 0.02;
  const insetY = height * 0.02;
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY },
  ];
}

export function autoDetectCorners(image) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const maxDim = 480;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(32, Math.round(sourceWidth * scale));
  const height = Math.max(32, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const gray = grayscale(data, width, height);
  const magnitude = sobelMagnitude(gray, width, height);

  const samples = [];
  for (let index = 0; index < magnitude.length; index += 1) {
    if (magnitude[index] > 0) {
      samples.push(magnitude[index]);
    }
  }
  samples.sort((a, b) => a - b);
  const threshold = samples[Math.floor(samples.length * 0.82)] || 24;

  const edgePoints = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (magnitude[index] >= threshold) {
        edgePoints.push({ x, y });
      }
    }
  }

  const detected = cornersFromEdges(edgePoints, width, height);
  const scaledCorners = (detected || fullImageCorners(width, height)).map((point) => ({
    x: (point.x / width) * sourceWidth,
    y: (point.y / height) * sourceHeight,
  }));

  return orderCorners(scaledCorners);
}
