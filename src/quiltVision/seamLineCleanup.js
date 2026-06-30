function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildSpatialGrid(segments, cellSize) {
  const grid = new Map();
  segments.forEach((point, index) => {
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key).push(index);
  });
  return grid;
}

export function nearestNeighborDistance(point, segments, cellSize = 6) {
  if (segments.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  const grid = buildSpatialGrid(segments, cellSize);
  const cellX = Math.floor(point.x / cellSize);
  const cellY = Math.floor(point.y / cellSize);
  let minDistance = Number.POSITIVE_INFINITY;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const bucket = grid.get(`${cellX + dx},${cellY + dy}`);
      if (!bucket) {
        continue;
      }
      bucket.forEach((index) => {
        const candidate = segments[index];
        if (candidate.x === point.x && candidate.y === point.y) {
          return;
        }
        const nextDistance = distance(point, candidate);
        if (nextDistance < minDistance) {
          minDistance = nextDistance;
        }
      });
    }
  }

  return minDistance;
}

function filterOutlierDots(segments, spreadThreshold) {
  return segments.filter((point) => nearestNeighborDistance(point, segments) <= spreadThreshold);
}

function buildNeighborLists(segments, linkDistance, cellSize = 4) {
  const grid = buildSpatialGrid(segments, cellSize);
  const neighbors = Array.from({ length: segments.length }, () => []);

  segments.forEach((point, index) => {
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bucket = grid.get(`${cellX + dx},${cellY + dy}`);
        if (!bucket) {
          continue;
        }
        bucket.forEach((otherIndex) => {
          if (otherIndex <= index) {
            return;
          }
          if (distance(point, segments[otherIndex]) <= linkDistance) {
            neighbors[index].push(otherIndex);
            neighbors[otherIndex].push(index);
          }
        });
      }
    }
  });

  return neighbors;
}

function orderChain(indices, segments, neighbors) {
  if (indices.length <= 2) {
    return indices.map((index) => segments[index]);
  }

  const indexSet = new Set(indices);
  let startIndex = indices.find((index) => neighbors[index].filter((n) => indexSet.has(n)).length <= 1);
  if (startIndex == null) {
    startIndex = indices[0];
  }

  const ordered = [];
  const visited = new Set();
  let current = startIndex;
  let previous = null;

  while (current != null && !visited.has(current)) {
    visited.add(current);
    ordered.push(segments[current]);
    const next = neighbors[current].find(
      (candidate) => indexSet.has(candidate) && candidate !== previous && !visited.has(candidate)
    );
    previous = current;
    current = next ?? null;
  }

  indices.forEach((index) => {
    if (!visited.has(index)) {
      ordered.push(segments[index]);
    }
  });

  return ordered;
}

function collectChains(segments, neighbors, minChainLength) {
  const visited = new Set();
  const chains = [];

  for (let index = 0; index < segments.length; index += 1) {
    if (visited.has(index)) {
      continue;
    }

    const stack = [index];
    const component = [];
    visited.add(index);

    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      neighbors[current].forEach((neighbor) => {
        if (visited.has(neighbor)) {
          return;
        }
        visited.add(neighbor);
        stack.push(neighbor);
      });
    }

    if (component.length >= minChainLength) {
      chains.push(orderChain(component, segments, neighbors));
    }
  }

  return chains;
}

export function extractCleanSeamLines(boundaries, options = {}) {
  const spreadThreshold = options.spreadThreshold ?? 6;
  const linkDistance = options.linkDistance ?? 2.6;
  const minChainLength = options.minChainLength ?? 4;
  const segments = boundaries?.segments ?? [];

  if (!segments.length) {
    return [];
  }

  const keptDots = filterOutlierDots(segments, spreadThreshold);
  if (keptDots.length < minChainLength) {
    return [];
  }

  const neighbors = buildNeighborLists(keptDots, linkDistance);
  return collectChains(keptDots, neighbors, minChainLength);
}

export function drawCleanSeamLines(
  ctx,
  seamLines,
  color = 'rgba(61, 46, 38, 0.92)',
  lineWidth = 2.2
) {
  if (!seamLines.length) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  seamLines.forEach((chain) => {
    if (chain.length < 2) {
      return;
    }
    ctx.beginPath();
    ctx.moveTo(chain[0].x + 0.5, chain[0].y + 0.5);
    chain.slice(1).forEach((point) => {
      ctx.lineTo(point.x + 0.5, point.y + 0.5);
    });
    ctx.stroke();
  });

  ctx.restore();
}

export function summarizeSeamLines(seamLines) {
  const dotCount = seamLines.reduce((total, chain) => total + chain.length, 0);
  return {
    lineCount: seamLines.length,
    dotCount,
  };
}
