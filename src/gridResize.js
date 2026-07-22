import { createEmptyPieceMergeIds, indexToRowCol, rowColToIndex } from './mergeUtils';

/**
 * Map an old-grid cell into a resized grid.
 * Shrinking drops columns from the left and rows from the bottom.
 * Growing adds empty columns on the left and empty rows on the bottom.
 * So the kept design stays anchored to the top-right.
 */
export function mapResizedCellIndex(
  oldIndex,
  oldRows,
  oldColumns,
  newRows,
  newColumns
) {
  const { row, col } = indexToRowCol(oldIndex, oldColumns);
  const colShift = newColumns - oldColumns; // positive when growing (new cols on left)
  const newCol = col + colShift;
  const newRow = row;

  if (newRow < 0 || newRow >= newRows || newCol < 0 || newCol >= newColumns) {
    return null;
  }

  return rowColToIndex(newRow, newCol, newColumns);
}

function remapMerge(merge, oldColumns, oldRows, newColumns, newRows) {
  const mappedPieces = (merge.pieces || (merge.cells || []).map((index) => ({
    index,
    half: null,
  })))
    .map((piece) => {
      const nextIndex = mapResizedCellIndex(
        piece.index,
        oldRows,
        oldColumns,
        newRows,
        newColumns
      );
      if (nextIndex == null) {
        return null;
      }
      return { index: nextIndex, half: piece.half ?? null };
    })
    .filter(Boolean);

  if (mappedPieces.length < 2) {
    return null;
  }

  const cells = [...new Set(mappedPieces.map((piece) => piece.index))].sort(
    (a, b) => a - b
  );

  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  cells.forEach((index) => {
    const { row, col } = indexToRowCol(index, newColumns);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  });

  return {
    ...merge,
    pieces: mappedPieces,
    cells,
    minRow,
    minCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

/**
 * Resize one quilt side without wiping the design.
 * Trims from the left and bottom; expands on the left and bottom.
 */
export function resizeSideState(side, oldRows, oldColumns, newRows, newColumns) {
  const cellCount = newRows * newColumns;
  const next = {
    cellColors: Array(cellCount).fill(null),
    cellColorsB: Array(cellCount).fill(null),
    cellFabricIds: Array(cellCount).fill(null),
    cellFabricIdsB: Array(cellCount).fill(null),
    cellDiagonals: Array(cellCount).fill(null),
    selectedBlocks: [],
    merges: {},
    cellMergeIds: Array(cellCount).fill(null),
    pieceMergeIds: createEmptyPieceMergeIds(cellCount),
    borderProtected: Boolean(side?.borderProtected),
    borderDepth: Math.max(0, Number(side?.borderDepth) || 0),
    borderTopDepth: Math.max(0, Number(side?.borderTopDepth) || 0),
    borderBottomDepth: Math.max(0, Number(side?.borderBottomDepth) || 0),
  };

  const oldCount = oldRows * oldColumns;
  for (let oldIndex = 0; oldIndex < oldCount; oldIndex += 1) {
    const newIndex = mapResizedCellIndex(
      oldIndex,
      oldRows,
      oldColumns,
      newRows,
      newColumns
    );
    if (newIndex == null) {
      continue;
    }

    next.cellColors[newIndex] = side.cellColors?.[oldIndex] ?? null;
    next.cellColorsB[newIndex] = side.cellColorsB?.[oldIndex] ?? null;
    next.cellFabricIds[newIndex] = side.cellFabricIds?.[oldIndex] ?? null;
    next.cellFabricIdsB[newIndex] = side.cellFabricIdsB?.[oldIndex] ?? null;
    next.cellDiagonals[newIndex] = side.cellDiagonals?.[oldIndex] ?? null;
  }

  let nextMergeId = 1;
  Object.values(side?.merges || {}).forEach((merge) => {
    const remapped = remapMerge(merge, oldColumns, oldRows, newColumns, newRows);
    if (!remapped) {
      return;
    }
    const id = nextMergeId;
    nextMergeId += 1;
    next.merges[id] = { ...remapped, id };
    remapped.pieces.forEach(({ index, half }) => {
      if (half === 'b') {
        next.pieceMergeIds[index] = { ...next.pieceMergeIds[index], b: id };
      } else if (half === 'a') {
        next.pieceMergeIds[index] = { ...next.pieceMergeIds[index], a: id };
      } else {
        next.pieceMergeIds[index] = { a: id, b: id };
      }
    });
  });

  next.cellMergeIds = next.pieceMergeIds.map(({ a, b }) => {
    if (a != null && a === b) return a;
    if (a != null && b == null) return a;
    if (b != null && a == null) return b;
    return null;
  });

  return next;
}
