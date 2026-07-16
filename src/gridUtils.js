import { tileMergesFromSelection, parsePieceKey, pieceKey } from './mergeUtils';

export function getSelectionBounds(indices, columns) {
  if (!indices.length) {
    return null;
  }

  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;

  indices.forEach((index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  });

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

function toPatternIndex(index, columns, minRow, minCol, patternWidth) {
  const row = Math.floor(index / columns) - minRow;
  const col = (index % columns) - minCol;
  return row * patternWidth + col;
}

/**
 * Capture the selected motif for copy/paste tiling.
 * Options may include cellColorsB, cellDiagonals, cellFabricIds, cellFabricIdsB
 * so triangles and store fabrics survive the round-trip.
 */
export function extractPatternSnapshot(
  cellColors,
  merges,
  cellMergeIds,
  columns,
  selectedIndices,
  options = {}
) {
  if (!selectedIndices.length) {
    return { error: 'no_selection' };
  }

  const bounds = getSelectionBounds(selectedIndices, columns);
  if (!bounds) {
    return { error: 'no_selection' };
  }

  const {
    cellColorsB = null,
    cellDiagonals = null,
    cellFabricIds = null,
    cellFabricIdsB = null,
  } = options;

  const { minRow, minCol, width, height } = bounds;
  const pattern = Array.from({ length: height * width }, (_, i) => {
    const rowOffset = Math.floor(i / width);
    const colOffset = i % width;
    const index = (minRow + rowOffset) * columns + (minCol + colOffset);
    return cellColors[index] ?? null;
  });

  const patternB = cellColorsB
    ? Array.from({ length: height * width }, (_, i) => {
        const rowOffset = Math.floor(i / width);
        const colOffset = i % width;
        const index = (minRow + rowOffset) * columns + (minCol + colOffset);
        return cellColorsB[index] ?? null;
      })
    : null;

  const patternDiagonals = cellDiagonals
    ? Array.from({ length: height * width }, (_, i) => {
        const rowOffset = Math.floor(i / width);
        const colOffset = i % width;
        const index = (minRow + rowOffset) * columns + (minCol + colOffset);
        return cellDiagonals[index] ?? null;
      })
    : null;

  const patternFabricIds = cellFabricIds
    ? Array.from({ length: height * width }, (_, i) => {
        const rowOffset = Math.floor(i / width);
        const colOffset = i % width;
        const index = (minRow + rowOffset) * columns + (minCol + colOffset);
        return cellFabricIds[index] ?? null;
      })
    : null;

  const patternFabricIdsB = cellFabricIdsB
    ? Array.from({ length: height * width }, (_, i) => {
        const rowOffset = Math.floor(i / width);
        const colOffset = i % width;
        const index = (minRow + rowOffset) * columns + (minCol + colOffset);
        return cellFabricIdsB[index] ?? null;
      })
    : null;

  const hasColor =
    pattern.some((color) => color != null) ||
    (patternB || []).some((color) => color != null);

  if (!hasColor) {
    return { error: 'no_motif' };
  }

  const patternMerges = {};
  const patternCellMergeIds = Array(height * width).fill(null);

  Object.values(merges).forEach((merge) => {
    if (
      merge.minRow < minRow ||
      merge.minRow + merge.height > minRow + height ||
      merge.minCol < minCol ||
      merge.minCol + merge.width > minCol + width
    ) {
      return;
    }

    const relMinRow = merge.minRow - minRow;
    const relMinCol = merge.minCol - minCol;
    const sourcePieces =
      merge.pieces ||
      (merge.cells || []).map((cellIndex) => ({ index: cellIndex, half: null }));

    const cells = (merge.cells || sourcePieces.map((piece) => piece.index)).map((index) =>
      toPatternIndex(index, columns, minRow, minCol, width)
    );

    const pieces = sourcePieces.map((piece) => ({
      index: toPatternIndex(piece.index, columns, minRow, minCol, width),
      half: piece.half ?? null,
    }));

    patternMerges[merge.id] = {
      ...merge,
      minRow: relMinRow,
      minCol: relMinCol,
      cells,
      pieces,
    };

    cells.forEach((patternIndex) => {
      patternCellMergeIds[patternIndex] = merge.id;
    });
  });

  return {
    pattern,
    patternB,
    patternDiagonals,
    patternFabricIds,
    patternFabricIdsB,
    merges: patternMerges,
    cellMergeIds: patternCellMergeIds,
    width,
    height,
    anchorRow: minRow,
    anchorCol: minCol,
    error: null,
  };
}

function tilePatternField(patternField, rows, columns, width, height, anchorRow, anchorCol) {
  if (!patternField) {
    return Array(rows * columns).fill(null);
  }

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rowOffset = ((row - anchorRow) % height + height) % height;
    const colOffset = ((col - anchorCol) % width + width) % width;
    return patternField[rowOffset * width + colOffset] ?? null;
  });
}

export function applyPatternSnapshot(cellColors, rows, columns, snapshot) {
  const {
    pattern,
    patternB = null,
    patternDiagonals = null,
    patternFabricIds = null,
    patternFabricIdsB = null,
    merges: patternMerges,
    width,
    height,
    anchorRow = 0,
    anchorCol = 0,
  } = snapshot;

  const next = tilePatternField(pattern, rows, columns, width, height, anchorRow, anchorCol);
  const nextB = tilePatternField(patternB, rows, columns, width, height, anchorRow, anchorCol);
  const nextDiagonals = tilePatternField(
    patternDiagonals,
    rows,
    columns,
    width,
    height,
    anchorRow,
    anchorCol
  );
  const nextFabricIds = tilePatternField(
    patternFabricIds,
    rows,
    columns,
    width,
    height,
    anchorRow,
    anchorCol
  );
  const nextFabricIdsB = tilePatternField(
    patternFabricIdsB,
    rows,
    columns,
    width,
    height,
    anchorRow,
    anchorCol
  );

  const tiledMerges = tileMergesFromSelection(
    patternMerges,
    rows,
    columns,
    anchorRow,
    anchorCol,
    width,
    height
  );

  return {
    cellColors: next,
    cellColorsB: nextB,
    cellDiagonals: nextDiagonals,
    cellFabricIds: nextFabricIds,
    cellFabricIdsB: nextFabricIdsB,
    merges: tiledMerges.merges,
    cellMergeIds: tiledMerges.cellMergeIds,
    pieceMergeIds: tiledMerges.pieceMergeIds,
    error: null,
  };
}

export function applyTileFromSelection(
  cellColors,
  merges,
  cellMergeIds,
  rows,
  columns,
  selectedIndices,
  options = {}
) {
  const snapshot = extractPatternSnapshot(
    cellColors,
    merges,
    cellMergeIds,
    columns,
    selectedIndices,
    options
  );

  if (snapshot.error) {
    return {
      cellColors,
      cellColorsB: options.cellColorsB,
      cellDiagonals: options.cellDiagonals,
      merges,
      cellMergeIds,
      error: snapshot.error,
    };
  }

  return applyPatternSnapshot(cellColors, rows, columns, snapshot);
}

export function getColoredBlockIndices(cellColors) {
  return cellColors
    .map((color, index) => (color ? index : null))
    .filter((index) => index != null);
}

export function getColoredPieceKeys(cellColors, cellColorsB = [], cellDiagonals = []) {
  const keys = [];
  cellColors.forEach((color, index) => {
    if (cellDiagonals[index]) {
      if (color) {
        keys.push(pieceKey(index, 'a'));
      }
      if (cellColorsB[index]) {
        keys.push(pieceKey(index, 'b'));
      }
      return;
    }
    if (color) {
      keys.push(pieceKey(index, null));
    }
  });
  return keys;
}

/** Migrate legacy numeric cell selections to piece keys. */
export function normalizeSelectedPieces(selected, cellDiagonals = []) {
  if (!Array.isArray(selected) || !selected.length) {
    return [];
  }

  const keys = [];
  selected.forEach((item) => {
    if (typeof item === 'number') {
      if (cellDiagonals[item]) {
        keys.push(pieceKey(item, 'a'), pieceKey(item, 'b'));
      } else {
        keys.push(pieceKey(item, null));
      }
      return;
    }
    if (typeof item === 'string' && item.includes(':')) {
      keys.push(item);
    }
  });

  return [...new Set(keys)].sort();
}

export function selectedPiecesToCellIndices(selectedPieces) {
  return [
    ...new Set(
      (selectedPieces || []).map((item) =>
        typeof item === 'number' ? item : parsePieceKey(item).index
      )
    ),
  ].sort((a, b) => a - b);
}

export function addPieceSelections(selectedPieces, keys) {
  const set = new Set(selectedPieces);
  keys.forEach((key) => set.add(key));
  return [...set].sort();
}

export function removePieceSelections(selectedPieces, keys) {
  const remove = new Set(keys);
  return selectedPieces.filter((key) => !remove.has(key));
}

export function addBlockSelection(selectedBlocks, index) {
  const set = new Set(selectedBlocks);
  set.add(index);
  return [...set].sort((a, b) => a - b);
}

export function addBlockSelections(selectedBlocks, indices) {
  const set = new Set(selectedBlocks);
  indices.forEach((index) => set.add(index));
  return [...set].sort((a, b) => a - b);
}

export function removeBlockSelections(selectedBlocks, indices) {
  const remove = new Set(indices);
  return selectedBlocks.filter((index) => !remove.has(index));
}

export function toggleBlockSelection(selectedBlocks, index) {
  const set = new Set(selectedBlocks);
  if (set.has(index)) {
    set.delete(index);
  } else {
    set.add(index);
  }
  return [...set].sort((a, b) => a - b);
}
