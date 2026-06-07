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

export function applyTileFromSelection(
  cellColors,
  merges,
  cellMergeIds,
  rows,
  columns,
  selectedIndices
) {
  if (!selectedIndices.length) {
    return { cellColors, merges, cellMergeIds, error: 'no_selection' };
  }

  const bounds = getSelectionBounds(selectedIndices, columns);
  if (!bounds) {
    return { cellColors, merges, cellMergeIds, error: 'no_selection' };
  }

  const { minRow, minCol, width, height } = bounds;
  const pattern = Array.from({ length: height * width }, (_, i) => {
    const rowOffset = Math.floor(i / width);
    const colOffset = i % width;
    const index = (minRow + rowOffset) * columns + (minCol + colOffset);
    return cellColors[index] ?? null;
  });

  if (!pattern.some((color) => color != null)) {
    return { cellColors, merges, cellMergeIds, error: 'no_motif' };
  }

  const next = [...cellColors];
  for (let index = 0; index < rows * columns; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rowOffset = ((row - minRow) % height + height) % height;
    const colOffset = ((col - minCol) % width + width) % width;
    next[index] = pattern[rowOffset * width + colOffset];
  }

  const tiledMerges = tileMergesFromSelection(
    merges,
    rows,
    columns,
    minRow,
    minCol,
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

export function toggleBlockSelection(selectedBlocks, index) {
  const set = new Set(selectedBlocks);
  if (set.has(index)) {
    set.delete(index);
  } else {
    set.add(index);
  }
  return [...set].sort((a, b) => a - b);
}
