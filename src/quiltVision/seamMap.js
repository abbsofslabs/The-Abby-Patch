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

function blurGray(gray, width, height, radius) {
  const output = new Float32Array(gray.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          sum += gray[ny * width + nx];
          count += 1;
        }
      }
      output[y * width + x] = sum / count;
    }
  }
  return output;
}

export function buildSeamStrengthMap(imageData) {
  const { data, width, height } = imageData;
  const gray = grayscale(data, width, height);
  const fine = sobelMagnitude(gray, width, height);
  const coarseGray = blurGray(gray, width, height, 4);
  const coarse = sobelMagnitude(coarseGray, width, height);

  const seam = new Float32Array(width * height);
  for (let index = 0; index < seam.length; index += 1) {
    const printNoise = Math.max(0, fine[index] - coarse[index] * 0.65);
    const seamSignal = coarse[index] - printNoise * 0.35;
    seam[index] = Math.max(0, seamSignal);
  }

  return seam;
}

export function averageSeamOnEdge(seamMap, width, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  let sum = 0;

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    if (x < 0 || y < 0 || x >= width || y >= seamMap.length / width) {
      continue;
    }
    sum += seamMap[y * width + x];
  }

  return sum / (steps + 1);
}
