import { labDistance, rgbToLab } from './colorSpace';
import { averageSeamOnEdge, buildSeamStrengthMap } from './seamMap';
import { downscaleImageData, SEGMENTATION_MAX_DIMENSION, upscaleLabels } from './imageDataUtils';
import { buildRegionLabelMap } from './regionProcessing';
import { sensitivityToFabricParams, suppressFabricTexture } from './textureSuppression';

class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.size = Array(size).fill(1);
  }

  find(index) {
    let root = index;
    while (this.parent[root] !== root) {
      root = this.parent[root];
    }
    let current = index;
    while (this.parent[current] !== current) {
      const next = this.parent[current];
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  unite(a, b) {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) {
      return rootA;
    }
    if (this.size[rootA] < this.size[rootB]) {
      [rootA, rootB] = [rootB, rootA];
    }
    this.parent[rootB] = rootA;
    this.size[rootA] += this.size[rootB];
    return rootA;
  }
}

function buildRegionColorStats(labels, imageData) {
  const stats = new Map();

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    if (label < 0) {
      continue;
    }
    if (!stats.has(label)) {
      stats.set(label, { l: 0, a: 0, b: 0, count: 0 });
    }
    const entry = stats.get(label);
    const dataIndex = index * 4;
    const lab = rgbToLab(imageData[dataIndex], imageData[dataIndex + 1], imageData[dataIndex + 2]);
    entry.l += lab.l;
    entry.a += lab.a;
    entry.b += lab.b;
    entry.count += 1;
  }

  stats.forEach((entry) => {
    entry.l /= entry.count;
    entry.a /= entry.count;
    entry.b /= entry.count;
  });

  return stats;
}

function compactLabels(labels) {
  const remap = new Map();
  let next = 0;
  const compacted = new Int32Array(labels.length).fill(-1);

  labels.forEach((label, index) => {
    if (label < 0) {
      return;
    }
    if (!remap.has(label)) {
      remap.set(label, next);
      next += 1;
    }
    compacted[index] = remap.get(label);
  });

  return compacted;
}

function mergeSimilarAdjacentRegions(
  labels,
  width,
  height,
  smoothImageData,
  originalImageData,
  seamMap,
  colorThreshold,
  seamBlockThreshold
) {
  const smoothStats = buildRegionColorStats(labels, smoothImageData);
  const originalStats = buildRegionColorStats(labels, originalImageData);
  const labelList = [...smoothStats.keys()];
  const labelToIndex = new Map(labelList.map((label, index) => [label, index]));
  const uf = new UnionFind(labelList.length);
  const adjacency = new Map();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      const label = labels[index];
      const right = labels[index + 1];
      if (label < 0 || right < 0 || label === right) {
        continue;
      }
      const pairKey = label < right ? `${label}:${right}` : `${right}:${label}`;
      if (adjacency.has(pairKey)) {
        continue;
      }
      adjacency.set(pairKey, {
        labelA: label,
        labelB: right,
        smoothDiff: labDistance(smoothStats.get(label), smoothStats.get(right)),
        originalDiff: labDistance(originalStats.get(label), originalStats.get(right)),
        seamStrength: averageSeamOnEdge(seamMap, width, x, y, x + 1, y),
      });
    }
  }

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const label = labels[index];
      const below = labels[index + width];
      if (label < 0 || below < 0 || label === below) {
        continue;
      }
      const pairKey = label < below ? `${label}:${below}` : `${below}:${label}`;
      if (adjacency.has(pairKey)) {
        continue;
      }
      adjacency.set(pairKey, {
        labelA: label,
        labelB: below,
        smoothDiff: labDistance(smoothStats.get(label), smoothStats.get(below)),
        originalDiff: labDistance(originalStats.get(label), originalStats.get(below)),
        seamStrength: averageSeamOnEdge(seamMap, width, x, y, x, y + 1),
      });
    }
  }

  [...adjacency.values()]
    .sort((left, right) => left.smoothDiff - right.smoothDiff)
    .forEach((pair) => {
      if (pair.smoothDiff > colorThreshold * 0.9) {
        return;
      }
      if (pair.originalDiff > colorThreshold * 1.6) {
        return;
      }
      const seamRatio = pair.seamStrength / Math.max(pair.smoothDiff, 1);
      if (pair.seamStrength > seamBlockThreshold * 0.85 || seamRatio > 0.35) {
        return;
      }
      uf.unite(labelToIndex.get(pair.labelA), labelToIndex.get(pair.labelB));
    });

  const remap = new Map();
  let nextLabel = 0;
  const merged = new Int32Array(labels.length).fill(-1);

  labels.forEach((label, index) => {
    if (label < 0) {
      return;
    }
    const root = uf.find(labelToIndex.get(label));
    if (!remap.has(root)) {
      remap.set(root, nextLabel);
      nextLabel += 1;
    }
    merged[index] = remap.get(root);
  });

  return merged;
}

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

function mergeTinyRegions(labels, width, height, minRegionPixels) {
  const sizes = regionSizes(labels);
  const smallLabels = [...sizes.entries()]
    .filter(([, size]) => size < minRegionPixels)
    .map(([label]) => label);

  if (!smallLabels.length) {
    return labels;
  }

  const smallSet = new Set(smallLabels);
  const borderVotes = new Map();

  const noteBorder = (labelA, labelB) => {
    if (labelA === labelB || smallSet.has(labelB)) {
      return;
    }
    if (!borderVotes.has(labelA)) {
      borderVotes.set(labelA, new Map());
    }
    const votes = borderVotes.get(labelA);
    votes.set(labelB, (votes.get(labelB) || 0) + 1);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const label = labels[index];
      if (!smallSet.has(label)) {
        continue;
      }
      if (x + 1 < width) {
        noteBorder(label, labels[index + 1]);
      }
      if (y + 1 < height) {
        noteBorder(label, labels[index + width]);
      }
    }
  }

  const remap = new Map();
  smallLabels.forEach((label) => {
    const votes = borderVotes.get(label);
    if (!votes || !votes.size) {
      return;
    }
    let bestNeighbor = -1;
    let bestCount = 0;
    votes.forEach((count, neighbor) => {
      if (count > bestCount) {
        bestCount = count;
        bestNeighbor = neighbor;
      }
    });
    if (bestNeighbor >= 0) {
      remap.set(label, bestNeighbor);
    }
  });

  if (!remap.size) {
    return labels;
  }

  const next = new Int32Array(labels.length);
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    next[index] = remap.get(label) ?? label;
  }

  return compactLabels(next);
}

function segmentAtResolution(imageData, sensitivity) {
  const { width, height, data } = imageData;
  const params = sensitivityToFabricParams(sensitivity);
  const heavilySmoothed = suppressFabricTexture(imageData, sensitivity);
  const seamMap = buildSeamStrengthMap(imageData);

  let labels = buildRegionLabelMap(heavilySmoothed, sensitivity);
  labels = mergeSimilarAdjacentRegions(
    labels,
    width,
    height,
    heavilySmoothed.data,
    data,
    seamMap,
    params.colorThreshold,
    params.seamBlockThreshold
  );
  labels = mergeTinyRegions(labels, width, height, params.minRegionPixels);
  return labels;
}

export function segmentFabricPieces(originalImageData, sensitivity = 58) {
  const { width: fullWidth, height: fullHeight } = originalImageData;
  const { imageData: workingImage, scale } = downscaleImageData(
    originalImageData,
    SEGMENTATION_MAX_DIMENSION
  );

  let labels = segmentAtResolution(workingImage, sensitivity);

  if (scale < 0.999) {
    labels = upscaleLabels(
      labels,
      workingImage.width,
      workingImage.height,
      fullWidth,
      fullHeight
    );
    const params = sensitivityToFabricParams(sensitivity);
    labels = mergeTinyRegions(
      labels,
      fullWidth,
      fullHeight,
      Math.round(params.minRegionPixels)
    );
  }

  return { labels };
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

export function buildTraceResult(originalImageData, labels) {
  const colors = {};
  const uniqueLabels = [...new Set(labels)].filter((label) => label >= 0);
  uniqueLabels.forEach((label) => {
    colors[label] = averageColorForLabel(originalImageData, labels, label);
  });

  return {
    labels,
    colors,
    regionCount: uniqueLabels.length,
    width: originalImageData.width,
    height: originalImageData.height,
  };
}
