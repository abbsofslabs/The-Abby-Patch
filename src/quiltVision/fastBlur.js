import { createImageData } from './imageDataUtils';

function blurChannelHorizontal(data, width, height, radius, channelOffset) {
  const output = new Float32Array(width * height);
  const window = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;

    for (let x = 0; x < width; x += 1) {
      const addX = Math.min(width - 1, x + radius);
      const removeX = Math.max(0, x - radius - 1);

      if (x === 0) {
        for (let ix = 0; ix <= radius; ix += 1) {
          sum += data[(row + ix) * 4 + channelOffset];
        }
      } else {
        sum += data[(row + addX) * 4 + channelOffset];
        if (x - radius - 1 >= 0) {
          sum -= data[(row + removeX) * 4 + channelOffset];
        }
      }

      const count = Math.min(window, x + radius + 1) - Math.max(0, x - radius) ;
      output[row + x] = sum / count;
    }
  }

  return output;
}

function blurChannelVertical(temp, width, height, radius, channelOffset) {
  const output = new Float32Array(width * height);
  const window = radius * 2 + 1;

  for (let x = 0; x < width; x += 1) {
    let sum = 0;

    for (let y = 0; y < height; y += 1) {
      const addY = Math.min(height - 1, y + radius);
      const removeY = Math.max(0, y - radius - 1);

      if (y === 0) {
        for (let iy = 0; iy <= radius; iy += 1) {
          sum += temp[iy * width + x];
        }
      } else {
        sum += temp[addY * width + x];
        if (y - radius - 1 >= 0) {
          sum -= temp[removeY * width + x];
        }
      }

      const count = Math.min(window, y + radius + 1) - Math.max(0, y - radius);
      output[y * width + x] = sum / count;
    }
  }

  return output;
}

export function separableBoxBlur(imageData, radius) {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const safeRadius = Math.max(1, radius);

  [0, 1, 2].forEach((channelOffset) => {
    const horizontal = blurChannelHorizontal(data, width, height, safeRadius, channelOffset);
    const blurred = blurChannelVertical(horizontal, width, height, safeRadius, channelOffset);
    for (let index = 0; index < blurred.length; index += 1) {
      output[index * 4 + channelOffset] = Math.round(blurred[index]);
    }
  });

  for (let index = 0; index < width * height; index += 1) {
    output[index * 4 + 3] = 255;
  }

  return createImageData(output, width, height);
}
