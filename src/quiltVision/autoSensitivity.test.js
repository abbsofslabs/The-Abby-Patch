import { pickAutoSensitivity, scoreSegmentation } from './autoSensitivity';
import { buildRegionLabelMap } from './regionProcessing';
import { suppressFabricTexture } from './textureSuppression';

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

test('prefers a cleaner sensitivity for noisy single-fabric images', () => {
  const image = makeImageData(120, 120, (x, y) => {
    const noise = (x * 17 + y * 31) % 40;
    return { r: 180 + noise, g: 40 + (noise % 17), b: 40 + (noise % 11) };
  });

  const lowLabels = buildRegionLabelMap(suppressFabricTexture(image, 44), 44);
  const highLabels = buildRegionLabelMap(suppressFabricTexture(image, 76), 76);
  expect(scoreSegmentation(highLabels, 120, 120)).toBeGreaterThan(scoreSegmentation(lowLabels, 120, 120));
  expect(pickAutoSensitivity(image)).toBeGreaterThanOrEqual(52);
});
