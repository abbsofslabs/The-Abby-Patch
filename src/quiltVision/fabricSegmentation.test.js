import { segmentFabricPieces } from './fabricSegmentation';

function makeImageData(width, height, paintPixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const color = paintPixel(x, y);
      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = 255;
    }
  }
  return { data, width, height };
}

function countRegions(labels) {
  return new Set([...labels].filter((label) => label >= 0)).size;
}

test('treats noisy print on one fabric as a single piece', () => {
  const image = makeImageData(120, 120, (x, y) => {
    const noise = (x * 17 + y * 31) % 40;
    return { r: 180 + noise, g: 40 + (noise % 17), b: 40 + (noise % 11) };
  });

  const { labels } = segmentFabricPieces(image, 58);
  expect(countRegions(labels)).toBeLessThanOrEqual(4);
});

test('keeps separate fabric pieces apart at a seam', () => {
  const image = makeImageData(160, 120, (x) => {
    if (x < 70) {
      return { r: 210, g: 45, b: 45 };
    }
    if (x > 90) {
      return { r: 45, g: 75, b: 190 };
    }
    return { r: 20, g: 20, b: 20 };
  });

  const { labels } = segmentFabricPieces(image, 30);
  expect(countRegions(labels)).toBeGreaterThanOrEqual(2);
});

test('finds multiple blocks in a simple checkerboard', () => {
  const image = makeImageData(200, 200, (x, y) => {
    if (x >= 94 && x <= 106) {
      return { r: 15, g: 15, b: 15 };
    }
    if (y >= 94 && y <= 106) {
      return { r: 15, g: 15, b: 15 };
    }
    const left = x < 94;
    const top = y < 94;
    if (left && top) {
      return { r: 220, g: 220, b: 220 };
    }
    if (!left && top) {
      return { r: 200, g: 60, b: 60 };
    }
    if (left && !top) {
      return { r: 60, g: 90, b: 200 };
    }
    return { r: 70, g: 140, b: 70 };
  });

  const { labels } = segmentFabricPieces(image, 20);
  expect(countRegions(labels)).toBeGreaterThanOrEqual(2);
});
