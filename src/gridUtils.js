import { tileMergesFromSelection } from './mergeUtils';

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
    if (
      merge.minRow >= minRow &&
      merge.minRow + merge.height <= minRow + height &&
      merge.minCol >= minCol &&
      merge.minCol + merge.width <= minCol + width
    ) {
      const relMinRow = merge.minRow - minRow;
      const relMinCol = merge.minCol - minCol;
      patternMerges[merge.id] = {
        ...merge,
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
    next[index] = pattern[rowOffset * width + colOffset];
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
