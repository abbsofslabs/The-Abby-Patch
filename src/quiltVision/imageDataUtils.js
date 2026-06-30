export const SEGMENTATION_MAX_DIMENSION = 480;

export function createImageData(data, width, height) {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(data, width, height);
  }
  return { data, width, height };
}

export function downscaleImageData(imageData, maxDimension) {
  const { width, height, data } = imageData;
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  if (scale >= 0.999) {
    return { imageData, scale: 1 };
  }

  const newWidth = Math.max(32, Math.round(width * scale));
  const newHeight = Math.max(32, Math.round(height * scale));
  const output = new Uint8ClampedArray(newWidth * newHeight * 4);

  for (let y = 0; y < newHeight; y += 1) {
    const srcY = Math.min(height - 1, Math.floor((y / newHeight) * height));
    for (let x = 0; x < newWidth; x += 1) {
      const srcX = Math.min(width - 1, Math.floor((x / newWidth) * width));
      const srcIndex = (srcY * width + srcX) * 4;
      const dstIndex = (y * newWidth + x) * 4;
      output[dstIndex] = data[srcIndex];
      output[dstIndex + 1] = data[srcIndex + 1];
      output[dstIndex + 2] = data[srcIndex + 2];
      output[dstIndex + 3] = 255;
    }
  }

  return {
    imageData: createImageData(output, newWidth, newHeight),
    scale,
  };
}

export function upscaleLabels(labels, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return labels;
  }

  const output = new Int32Array(targetWidth * targetHeight);
  const scaleX = sourceWidth / targetWidth;
  const scaleY = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const srcY = Math.min(sourceHeight - 1, Math.floor(y * scaleY));
    for (let x = 0; x < targetWidth; x += 1) {
      const srcX = Math.min(sourceWidth - 1, Math.floor(x * scaleX));
      output[y * targetWidth + x] = labels[srcY * sourceWidth + srcX];
    }
  }

  return output;
}

export function packImageData(imageData) {
  return {
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  };
}

export function unpackImageData(packed) {
  return createImageData(packed.data, packed.width, packed.height);
}
