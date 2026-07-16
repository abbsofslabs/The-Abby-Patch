import { createEmptyPieceMergeIds, dissolveMergesTouchingIndices } from './mergeUtils';

/** Create a 1×width strip side-state for designing a border motif. */
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

/** Outer-ring cell indices (depth 1) on a rows×columns grid. */
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

function readStripCell(strip, offset) {
  const width = strip.columns || strip.cellColors?.length || 1;
  const i = ((offset % width) + width) % width;
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
 * Stamp border motif(s) onto the outer ring of a quilt side.
 * Top edge uses topStrip; bottom uses bottomStrip (or topStrip if omitted).
 * Left/right edges use topStrip, repeating vertically.
 */
export function applyBorderMotifsToSide(side, rows, columns, topStrip, bottomStrip = null) {
  if (!topStrip?.cellColors?.length || rows < 1 || columns < 1) {
    return side;
  }

  const bottom = bottomStrip || topStrip;
  const cellCount = rows * columns;
  const borderIndices = [...getBorderCellIndices(rows, columns)];
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
    // Applying a border locks the outer ring against paste-across.
    borderProtected: true,
  };

  // Top row
  for (let col = 0; col < columns; col += 1) {
    writeCell(next, col, readStripCell(topStrip, col));
  }

  // Bottom row
  if (rows > 1) {
    const rowBase = (rows - 1) * columns;
    for (let col = 0; col < columns; col += 1) {
      writeCell(next, rowBase + col, readStripCell(bottom, col));
    }
  }

  // Left & right columns (skip corners already painted)
  for (let row = 1; row < rows - 1; row += 1) {
    writeCell(next, row * columns, readStripCell(topStrip, row));
    if (columns > 1) {
      writeCell(next, row * columns + (columns - 1), readStripCell(topStrip, row));
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
    return { ...tiledSide, borderProtected: false };
  }

  const protectedCells = getBorderCellIndices(rows, columns);
  const cellCount = rows * columns;
  const next = {
    ...tiledSide,
    cellColors: [...tiledSide.cellColors],
    cellColorsB: [...(tiledSide.cellColorsB || Array(cellCount).fill(null))],
    cellFabricIds: [...(tiledSide.cellFabricIds || Array(cellCount).fill(null))],
    cellFabricIdsB: [...(tiledSide.cellFabricIdsB || Array(cellCount).fill(null))],
    cellDiagonals: [...(tiledSide.cellDiagonals || Array(cellCount).fill(null))],
    borderProtected: true,
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
