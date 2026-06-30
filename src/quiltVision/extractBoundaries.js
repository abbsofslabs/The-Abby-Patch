export function extractBoundaries(labelMap, width, height) {
  const boundary = new Uint8Array(width * height);
  const segments = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const label = labelMap[index];
      if (label < 0) {
        continue;
      }

      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      const isEdge = neighbors.some(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return true;
        }
        return labelMap[ny * width + nx] !== label;
      });

      if (isEdge) {
        boundary[index] = 1;
        segments.push({ x, y });
      }
    }
  }

  return {
    width,
    height,
    boundary,
    segments,
    regionCount: new Set([...labelMap].filter((label) => label >= 0)).size,
  };
}

export function drawBoundaryOverlay(ctx, boundaries, color = 'rgba(61, 46, 38, 0.9)', lineWidth = 2) {
  const { width, height, boundary } = boundaries;
  const imageData = ctx.createImageData(width, height);
  const [r, g, b] = [61, 46, 38];

  for (let index = 0; index < boundary.length; index += 1) {
    if (!boundary[index]) {
      continue;
    }
    const dataIndex = index * 4;
    imageData.data[dataIndex] = r;
    imageData.data[dataIndex + 1] = g;
    imageData.data[dataIndex + 2] = b;
    imageData.data[dataIndex + 3] = 230;
  }

  ctx.putImageData(imageData, 0, 0);
}

export function renderFilledRegions(canvas, labelMap, regionColors, width, height) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(width, height);

  for (let index = 0; index < labelMap.length; index += 1) {
    const label = labelMap[index];
    if (label < 0) {
      continue;
    }
    const hex = regionColors[label] || '#F5F0E6';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dataIndex = index * 4;
    imageData.data[dataIndex] = r;
    imageData.data[dataIndex + 1] = g;
    imageData.data[dataIndex + 2] = b;
    imageData.data[dataIndex + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

export function regionAtPoint(labelMap, width, x, y) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width) {
    return -1;
  }
  const index = py * width + px;
  return labelMap[index] ?? -1;
}
