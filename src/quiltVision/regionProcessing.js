import { createImageData } from './imageDataUtils';

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function medianFilter(imageData, radius = 1) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rs = [];
      const gs = [];
      const bs = [];

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          const index = (ny * width + nx) * 4;
          rs.push(data[index]);
          gs.push(data[index + 1]);
          bs.push(data[index + 2]);
        }
      }

      const outIndex = (y * width + x) * 4;
      output[outIndex] = medianOf(rs);
      output[outIndex + 1] = medianOf(gs);
      output[outIndex + 2] = medianOf(bs);
      output[outIndex + 3] = 255;
    }
  }

  return createImageData(output, width, height);
}

function colorKey(r, g, b, bucket) {
  const qr = Math.round(r / bucket) * bucket;
  const qg = Math.round(g / bucket) * bucket;
  const qb = Math.round(b / bucket) * bucket;
  return `${qr},${qg},${qb}`;
}

function sensitivityToBucket(sensitivity) {
  const level = Math.max(1, Math.min(100, sensitivity)) / 100;
  return Math.max(8, Math.round(10 + level * 48));
}

export function buildRegionLabelMap(imageData, sensitivity = 50) {
  const { data, width, height } = imageData;
  const bucket = sensitivityToBucket(sensitivity);
  const keys = new Int32Array(width * height).fill(-1);
  const keyToId = new Map();
  let nextKeyId = 0;

  for (let index = 0; index < width * height; index += 1) {
    const dataIndex = index * 4;
    const key = colorKey(data[dataIndex], data[dataIndex + 1], data[dataIndex + 2], bucket);
    if (!keyToId.has(key)) {
      keyToId.set(key, nextKeyId);
      nextKeyId += 1;
    }
    keys[index] = keyToId.get(key);
  }

  const labels = new Int32Array(width * height).fill(-1);
  let nextLabel = 0;

  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] >= 0) {
      continue;
    }

    const keyId = keys[index];
    const stack = [index];
    labels[index] = nextLabel;

    while (stack.length) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      neighbors.forEach(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return;
        }
        const neighborIndex = ny * width + nx;
        if (labels[neighborIndex] >= 0 || keys[neighborIndex] !== keyId) {
          return;
        }
        labels[neighborIndex] = nextLabel;
        stack.push(neighborIndex);
      });
    }

    nextLabel += 1;
  }

  return labels;
}

export function averageColorForLabel(imageData, labels, labelId) {
  const { data } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] !== labelId) {
      continue;
    }
    const dataIndex = index * 4;
    r += data[dataIndex];
    g += data[dataIndex + 1];
    b += data[dataIndex + 2];
    count += 1;
  }

  if (!count) {
    return '#F5F0E6';
  }

  const toHex = (value) => Math.round(value / count).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
