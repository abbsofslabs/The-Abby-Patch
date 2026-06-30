import { extractBoundaries } from './extractBoundaries';
import { buildRegionLabelMap } from './regionProcessing';
import { nearestNeighborDistance } from './seamLineCleanup';
import { downscaleImageData } from './imageDataUtils';
import { suppressFabricTexture } from './textureSuppression';

const AUTO_SENSITIVITY_CANDIDATES = [52, 62, 72];

function regionSizes(labels) {
  const sizes = new Map();
  labels.forEach((label) => {
    if (label < 0) {
      return;
    }
    sizes.set(label, (sizes.get(label) || 0) + 1);
  });
  return sizes;
}

function quickPreviewSegment(imageData, sensitivity) {
  const smoothed = suppressFabricTexture(imageData, sensitivity);
  return buildRegionLabelMap(smoothed, sensitivity);
}

export function scoreSegmentation(labels, width, height) {
  const regionCount = new Set([...labels].filter((label) => label >= 0)).size;
  if (regionCount < 1 || regionCount > 200) {
    return Number.NEGATIVE_INFINITY;
  }

  const { segments } = extractBoundaries(labels, width, height);
  if (segments.length < 20) {
    return regionCount === 1 ? 20 : Number.NEGATIVE_INFINITY;
  }

  const sampleStride = segments.length > 1500 ? Math.ceil(segments.length / 1500) : 1;
  let outlierCount = 0;
  let tightCount = 0;
  let sampleCount = 0;

  for (let index = 0; index < segments.length; index += sampleStride) {
    const point = segments[index];
    sampleCount += 1;
    const nearest = nearestNeighborDistance(point, segments, 6);
    if (nearest > 6) {
      outlierCount += 1;
    }
    if (nearest <= 2.5) {
      tightCount += 1;
    }
  }

  const outlierRatio = outlierCount / sampleCount;
  const tightRatio = tightCount / sampleCount;
  const sizes = regionSizes(labels);
  const tinyRatio = [...sizes.values()].filter((size) => size < 70).length / regionCount;

  let score = tightRatio * 45 - outlierRatio * 55 - tinyRatio * 35;

  if (regionCount > 100) {
    score -= (regionCount - 100) * 0.4;
  }
  if (regionCount === 1) {
    score += 18;
  }

  return score;
}

export function pickAutoSensitivity(imageData) {
  const { imageData: preview } = downscaleImageData(imageData, 200);
  let bestSensitivity = 62;
  let bestScore = Number.NEGATIVE_INFINITY;

  AUTO_SENSITIVITY_CANDIDATES.forEach((candidate) => {
    const labels = quickPreviewSegment(preview, candidate);
    const score = scoreSegmentation(labels, preview.width, preview.height);
    if (score > bestScore) {
      bestScore = score;
      bestSensitivity = candidate;
    }
  });

  return bestSensitivity;
}
