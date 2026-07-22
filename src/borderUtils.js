import {
  createEmptyPieceMergeIds,
  dissolveMergesTouchingIndices,
  mergePieces,
} from './mergeUtils';

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

function colorKey(color) {
  return color ? String(color).toLowerCase() : null;
}

function applyMergeRect(side, rows, columns, minRow, maxRow, minCol, maxCol) {
  if (maxRow < minRow || maxCol < minCol) {
    return;
  }

  const pieces = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      pieces.push({ index: row * columns + col, half: null });
    }
  }

  if (pieces.length < 2) {
    return;
  }

  const result = mergePieces(
    pieces,
    side.cellColors,
    side.cellColorsB,
    side.cellDiagonals,
    columns,
    rows,
    side.merges,
    side.pieceMergeIds
  );

  if (!result.ok) {
    return;
  }

  side.merges = result.merges;
  side.pieceMergeIds = result.pieceMergeIds;
  side.cellMergeIds = result.cellMergeIds;
}

function rowIsSolidColor(side, row, columns, expectedColor) {
  for (let col = 0; col < columns; col += 1) {
    const index = row * columns + col;
    if (side.cellDiagonals?.[index]) {
      return false;
    }
    if (colorKey(side.cellColors?.[index]) !== expectedColor) {
      return false;
    }
  }
  return true;
}

function colIsSolidColor(side, col, rowStart, rowEnd, columns, expectedColor) {
  for (let row = rowStart; row < rowEnd; row += 1) {
    const index = row * columns + col;
    if (side.cellDiagonals?.[index]) {
      return false;
    }
    if (colorKey(side.cellColors?.[index]) !== expectedColor) {
      return false;
    }
  }
  return true;
}

/** Merge consecutive same-color full-width rows into strip rectangles. */
function mergeHorizontalStripRuns(side, rows, columns, rowStart, rowEnd) {
  let row = rowStart;
  while (row < rowEnd) {
    const sampleIndex = row * columns;
    const expected = colorKey(side.cellColors?.[sampleIndex]);
    if (!expected || !rowIsSolidColor(side, row, columns, expected)) {
      row += 1;
      continue;
    }

    let end = row + 1;
    while (end < rowEnd && rowIsSolidColor(side, end, columns, expected)) {
      end += 1;
    }

    applyMergeRect(side, rows, columns, row, end - 1, 0, columns - 1);
    row = end;
  }
}

/** Merge consecutive same-color full-height columns into strip rectangles. */
function mergeVerticalStripRuns(side, rows, columns, colStart, colEnd, rowStart, rowEnd) {
  if (rowEnd - rowStart < 1 || colEnd - colStart < 1) {
    return;
  }

  let col = colStart;
  while (col < colEnd) {
    const sampleIndex = rowStart * columns + col;
    const expected = colorKey(side.cellColors?.[sampleIndex]);
    if (
      !expected ||
      !colIsSolidColor(side, col, rowStart, rowEnd, columns, expected)
    ) {
      col += 1;
      continue;
    }

    let end = col + 1;
    while (
      end < colEnd &&
      colIsSolidColor(side, end, rowStart, rowEnd, columns, expected)
    ) {
      end += 1;
    }

    applyMergeRect(side, rows, columns, rowStart, rowEnd - 1, col, end - 1);
    col = end;
  }
}

/**
 * Same-color border layers become one merged strip per side.
 * Different colors stay as separate single-layer strips.
 */
export function autoMergeAppliedBorder(
  side,
  rows,
  columns,
  topDepth = null,
  bottomDepth = null
) {
  const topD = Math.max(
    0,
    Number(topDepth ?? side.borderTopDepth ?? side.borderDepth) || 0
  );
  const bottomD = Math.max(
    0,
    Number(bottomDepth ?? side.borderBottomDepth ?? side.borderDepth) || 0
  );

  if (topD < 1 && bottomD < 1) {
    return side;
  }

  const cellCount = rows * columns;
  const next = {
    ...side,
    merges: { ...(side.merges || {}) },
    cellMergeIds: [...(side.cellMergeIds || Array(cellCount).fill(null))],
    pieceMergeIds: (side.pieceMergeIds || createEmptyPieceMergeIds(cellCount)).map(
      (piece) => ({ a: piece?.a ?? null, b: piece?.b ?? null })
    ),
    borderTopDepth: topD,
    borderBottomDepth: bottomD,
    borderDepth: Math.max(topD, bottomD),
  };

  mergeHorizontalStripRuns(next, rows, columns, 0, Math.min(topD, rows));

  const bottomStart = Math.max(Math.min(topD, rows), rows - bottomD);
  mergeHorizontalStripRuns(next, rows, columns, bottomStart, rows);

  const middleStart = Math.min(topD, rows);
  const middleEnd = Math.max(middleStart, rows - bottomD);
  const sideDepth = topD;

  if (middleEnd > middleStart && sideDepth > 0) {
    mergeVerticalStripRuns(
      next,
      rows,
      columns,
      0,
      Math.min(sideDepth, columns),
      middleStart,
      middleEnd
    );
    const rightStart = Math.max(Math.min(sideDepth, columns), columns - sideDepth);
    mergeVerticalStripRuns(
      next,
      rows,
      columns,
      rightStart,
      columns,
      middleStart,
      middleEnd
    );
  }

  return next;
}

/**
 * Stamp a thick border frame onto a quilt side.
 * The strip is a depth cross-section: [0] outer edge → [n-1] toward the center.
 * Top (and left/right) use topStrip; bottom uses bottomStrip when provided.
 * Same-color layers auto-merge into strips; different colors stay separate.
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
    borderTopDepth: topDepth,
    borderBottomDepth: bottomDepth,
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

  return autoMergeAppliedBorder(next, rows, columns, topDepth, bottomDepth);
}

/**
 * When tiling a pattern across the quilt, restore protected border cells
 * from the previous side state so paste-across cannot overwrite them.
 */
export function restoreProtectedBorderCells(previousSide, tiledSide, rows, columns) {
  if (!previousSide?.borderProtected) {
    return {
      ...tiledSide,
      borderProtected: false,
      borderDepth: 0,
      borderTopDepth: 0,
      borderBottomDepth: 0,
    };
  }

  const depth = Math.max(1, previousSide.borderDepth || 1);
  const topDepth = Math.max(1, previousSide.borderTopDepth || depth);
  const bottomDepth = Math.max(1, previousSide.borderBottomDepth || depth);
  const protectedCells = getBorderCellIndices(rows, columns, depth);
  const cellCount = rows * columns;

  const dissolved = dissolveMergesTouchingIndices(
    tiledSide.merges || {},
    tiledSide.cellMergeIds || Array(cellCount).fill(null),
    [...protectedCells],
    tiledSide.pieceMergeIds || createEmptyPieceMergeIds(cellCount)
  );

  const next = {
    ...tiledSide,
    cellColors: [...tiledSide.cellColors],
    cellColorsB: [...(tiledSide.cellColorsB || Array(cellCount).fill(null))],
    cellFabricIds: [...(tiledSide.cellFabricIds || Array(cellCount).fill(null))],
    cellFabricIdsB: [...(tiledSide.cellFabricIdsB || Array(cellCount).fill(null))],
    cellDiagonals: [...(tiledSide.cellDiagonals || Array(cellCount).fill(null))],
    merges: dissolved.merges,
    cellMergeIds: dissolved.cellMergeIds,
    pieceMergeIds: dissolved.pieceMergeIds,
    borderProtected: true,
    borderDepth: depth,
    borderTopDepth: topDepth,
    borderBottomDepth: bottomDepth,
  };

  protectedCells.forEach((index) => {
    next.cellColors[index] = previousSide.cellColors?.[index] ?? null;
    next.cellColorsB[index] = previousSide.cellColorsB?.[index] ?? null;
    next.cellFabricIds[index] = previousSide.cellFabricIds?.[index] ?? null;
    next.cellFabricIdsB[index] = previousSide.cellFabricIdsB?.[index] ?? null;
    next.cellDiagonals[index] = previousSide.cellDiagonals?.[index] ?? null;
  });

  return autoMergeAppliedBorder(next, rows, columns, topDepth, bottomDepth);
}
