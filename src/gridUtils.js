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

export function extractPatternSnapshot(
  cellColors,
  merges,
  cellMergeIds,
  columns,
  selectedIndices
) {
  if (!selectedIndices.length) {
    return { error: 'no_selection' };
  }

  const bounds = getSelectionBounds(selectedIndices, columns);
  if (!bounds) {
    return { error: 'no_selection' };
  }

  const { minRow, minCol, width, height } = bounds;
  const pattern = Array.from({ length: height * width }, (_, i) => {
    const rowOffset = Math.floor(i / width);
    const colOffset = i % width;
    const index = (minRow + rowOffset) * columns + (minCol + colOffset);
    return cellColors[index] ?? null;
  });

  if (!pattern.some((color) => color != null)) {
    return { error: 'no_motif' };
  }

  const patternMerges = {};
  const patternCellMergeIds = Array(height * width).fill(null);

  Object.values(merges).forEach((merge) => {
    // Only full-cell merges tile cleanly; triangle-half merges stay behind.
    const hasHalfPieces = merge.pieces?.some((piece) => piece.half != null);
    if (
      !hasHalfPieces &&
      merge.minRow >= minRow &&
      merge.minRow + merge.height <= minRow + height &&
      merge.minCol >= minCol &&
      merge.minCol + merge.width <= minCol + width
    ) {
      const relMinRow = merge.minRow - minRow;
      const relMinCol = merge.minCol - minCol;
      patternMerges[merge.id] = {
        ...merge,
        pieces: null,
        minRow: relMinRow,
        minCol: relMinCol,
        cells: merge.cells.map((index) => {
          const row = Math.floor(index / columns) - minRow;
          const col = (index % columns) - minCol;
          return row * width + col;
        }),
      };
      merge.cells.forEach((index) => {
        const row = Math.floor(index / columns) - minRow;
        const col = (index % columns) - minCol;
        patternCellMergeIds[row * width + col] = merge.id;
      });
    }
  });

  return {
    pattern,
    merges: patternMerges,
    cellMergeIds: patternCellMergeIds,
    width,
    height,
    anchorRow: minRow,
    anchorCol: minCol,
    error: null,
  };
}

export function applyPatternSnapshot(cellColors, rows, columns, snapshot) {
  const {
    pattern,
    merges: patternMerges,
    width,
    height,
    anchorRow = 0,
    anchorCol = 0,
  } = snapshot;
  const next = [...cellColors];

  for (let index = 0; index < rows * columns; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rowOffset = ((row - anchorRow) % height + height) % height;
    const colOffset = ((col - anchorCol) % width + width) % width;
    const patternIndex = rowOffset * width + colOffset;
    next[index] = pattern[patternIndex];
  }

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
  selectedIndices
) {
  const snapshot = extractPatternSnapshot(
    cellColors,
    merges,
    cellMergeIds,
    columns,
    selectedIndices
  );

  if (snapshot.error) {
    return { cellColors, merges, cellMergeIds, error: snapshot.error };
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
