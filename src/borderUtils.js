import { createEmptyPieceMergeIds, dissolveMergesTouchingIndices } from './mergeUtils';

/**
 * Create a 1×width strip for a border cross-section.
 * Index 0 = outermost ring; last index = innermost border ring.
 */
export function createBorderStripState(width) {
  const w = Math.max(1, Math.floor(Number(width) || 1));
  const cellCount = w;
  return {
    width: w,
    rows: 1,
    columns: w,
    cellColors: Array(cellCount).fill(null),
    cellColorsB: Array(cellCount).fill(null),
    cellFabricIds: Array(cellCount).fill(null),
    cellFabricIdsB: Array(cellCount).fill(null),
    cellDiagonals: Array(cellCount).fill(null),
    selectedBlocks: [],
    merges: {},
    cellMergeIds: Array(cellCount).fill(null),
    pieceMergeIds: createEmptyPieceMergeIds(cellCount),
  };
}

export function resizeBorderStrip(strip, nextWidth) {
  const w = Math.max(1, Math.floor(Number(nextWidth) || 1));
  if (strip?.columns === w) {
    return strip;
  }

  const next = createBorderStripState(w);
  const copyCount = Math.min(strip?.columns || 0, w);
  for (let i = 0; i < copyCount; i += 1) {
    next.cellColors[i] = strip.cellColors?.[i] ?? null;
    next.cellColorsB[i] = strip.cellColorsB?.[i] ?? null;
    next.cellFabricIds[i] = strip.cellFabricIds?.[i] ?? null;
    next.cellFabricIdsB[i] = strip.cellFabricIdsB?.[i] ?? null;
    next.cellDiagonals[i] = strip.cellDiagonals?.[i] ?? null;
  }
  return next;
}

/** Cells within `depth` blocks of any outer edge. */
export function getBorderCellIndices(rows, columns, depth = 1) {
  const d = Math.max(1, Math.floor(depth));
  const set = new Set();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const onBorder =
        row < d ||
        col < d ||
        row >= rows - d ||
        col >= columns - d;
      if (onBorder) {
        set.add(row * columns + col);
      }
    }
  }

  return set;
}

export function getBorderDepthFromStrips(topStrip, bottomStrip = null) {
  const top = Math.max(1, topStrip?.columns || 1);
  const bottom = bottomStrip ? Math.max(1, bottomStrip.columns || 1) : top;
  return Math.max(top, bottom);
}

function readStripLayer(strip, depthIndex) {
  const width = strip.columns || strip.cellColors?.length || 1;
  const i = Math.max(0, Math.min(width - 1, depthIndex));
  return {
    color: strip.cellColors?.[i] ?? null,
    colorB: strip.cellColorsB?.[i] ?? null,
    fabricId: strip.cellFabricIds?.[i] ?? null,
    fabricIdB: strip.cellFabricIdsB?.[i] ?? null,
    diagonal: strip.cellDiagonals?.[i] ?? null,
  };
}

function writeCell(sideArrays, index, cell) {
  sideArrays.cellColors[index] = cell.color;
  sideArrays.cellColorsB[index] = cell.colorB;
  sideArrays.cellFabricIds[index] = cell.fabricId;
  sideArrays.cellFabricIdsB[index] = cell.fabricIdB;
  sideArrays.cellDiagonals[index] = cell.diagonal;
}

/**
 * Stamp a thick border frame onto a quilt side.
 * The strip is a depth cross-section: [0] outer edge → [n-1] toward the center.
 * Top (and left/right) use topStrip; bottom uses bottomStrip when provided.
 */
export function applyBorderMotifsToSide(side, rows, columns, topStrip, bottomStrip = null) {
  if (!topStrip?.cellColors?.length || rows < 1 || columns < 1) {
    return side;
  }

  const bottom = bottomStrip || topStrip;
  const topDepth = Math.max(1, topStrip.columns || 1);
  const bottomDepth = Math.max(1, bottom.columns || 1);
  const sideDepth = topDepth;
  const protectDepth = Math.max(topDepth, bottomDepth);
  const cellCount = rows * columns;
  const borderIndices = [...getBorderCellIndices(rows, columns, protectDepth)];
  const dissolved = dissolveMergesTouchingIndices(
    side.merges || {},
    side.cellMergeIds || Array(cellCount).fill(null),
    borderIndices,
    side.pieceMergeIds || createEmptyPieceMergeIds(cellCount)
  );

  const next = {
    ...side,
    cellColors: [...side.cellColors],
    cellColorsB: [...(side.cellColorsB || Array(cellCount).fill(null))],
    cellFabricIds: [...(side.cellFabricIds || Array(cellCount).fill(null))],
    cellFabricIdsB: [...(side.cellFabricIdsB || Array(cellCount).fill(null))],
    cellDiagonals: [...(side.cellDiagonals || Array(cellCount).fill(null))],
    merges: dissolved.merges,
    cellMergeIds: dissolved.cellMergeIds,
    pieceMergeIds: dissolved.pieceMergeIds,
    borderProtected: true,
    borderDepth: protectDepth,
  };

  // Top band — full width, includes top corners (outside → inward by row).
  for (let d = 0; d < topDepth && d < rows; d += 1) {
    const cell = readStripLayer(topStrip, d);
    for (let col = 0; col < columns; col += 1) {
      writeCell(next, d * columns + col, cell);
    }
  }

  // Bottom band — full width, includes bottom corners.
  for (let d = 0; d < bottomDepth && d < rows; d += 1) {
    const row = rows - 1 - d;
    // If top already claimed this row (small quilt), keep the nearer edge.
    if (row < topDepth && d >= row) {
      continue;
    }
    const cell = readStripLayer(bottom, d);
    for (let col = 0; col < columns; col += 1) {
      writeCell(next, row * columns + col, cell);
    }
  }

  // Left & right — middle rows only (corners already filled by top/bottom).
  const middleStart = Math.min(topDepth, rows);
  const middleEnd = Math.max(middleStart, rows - bottomDepth);
  for (let d = 0; d < sideDepth && d < columns; d += 1) {
    const cell = readStripLayer(topStrip, d);
    for (let row = middleStart; row < middleEnd; row += 1) {
      writeCell(next, row * columns + d, cell);
      if (columns > 1) {
        const rightCol = columns - 1 - d;
        if (rightCol > d) {
          writeCell(next, row * columns + rightCol, cell);
        }
      }
    }
  }

  return next;
}

/**
 * When tiling a pattern across the quilt, restore protected border cells
 * from the previous side state so paste-across cannot overwrite them.
 */
export function restoreProtectedBorderCells(previousSide, tiledSide, rows, columns) {
  if (!previousSide?.borderProtected) {
    return { ...tiledSide, borderProtected: false, borderDepth: 0 };
  }

  const depth = Math.max(1, previousSide.borderDepth || 1);
  const protectedCells = getBorderCellIndices(rows, columns, depth);
  const cellCount = rows * columns;
  const next = {
    ...tiledSide,
    cellColors: [...tiledSide.cellColors],
    cellColorsB: [...(tiledSide.cellColorsB || Array(cellCount).fill(null))],
    cellFabricIds: [...(tiledSide.cellFabricIds || Array(cellCount).fill(null))],
    cellFabricIdsB: [...(tiledSide.cellFabricIdsB || Array(cellCount).fill(null))],
    cellDiagonals: [...(tiledSide.cellDiagonals || Array(cellCount).fill(null))],
    borderProtected: true,
    borderDepth: depth,
  };

  protectedCells.forEach((index) => {
    next.cellColors[index] = previousSide.cellColors?.[index] ?? null;
    next.cellColorsB[index] = previousSide.cellColorsB?.[index] ?? null;
    next.cellFabricIds[index] = previousSide.cellFabricIds?.[index] ?? null;
    next.cellFabricIdsB[index] = previousSide.cellFabricIdsB?.[index] ?? null;
    next.cellDiagonals[index] = previousSide.cellDiagonals?.[index] ?? null;
  });

  return next;
}
