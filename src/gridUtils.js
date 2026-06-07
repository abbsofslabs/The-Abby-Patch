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

export function getMotifBounds(cellColors, selectedIndices, columns) {
  const coloredIndices = selectedIndices.filter((index) => cellColors[index] != null);

  if (!coloredIndices.length) {
    return null;
  }

  return getSelectionBounds(coloredIndices, columns);
}

export function applyTileToSelection(cellColors, columns, selectedIndices) {
  if (!selectedIndices.length) {
    return { cellColors, error: 'no_selection' };
  }

  const motifBounds = getMotifBounds(cellColors, selectedIndices, columns);
  if (!motifBounds) {
    return { cellColors, error: 'no_motif' };
  }

  const { minRow, minCol, width, height } = motifBounds;
  const pattern = Array.from({ length: height * width }, (_, i) => {
    const rowOffset = Math.floor(i / width);
    const colOffset = i % width;
    const index = (minRow + rowOffset) * columns + (minCol + colOffset);
    return cellColors[index] ?? null;
  });

  const next = [...cellColors];
  selectedIndices.forEach((index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rowOffset = ((row - minRow) % height + height) % height;
    const colOffset = ((col - minCol) % width + width) % width;
    next[index] = pattern[rowOffset * width + colOffset];
  });

  return { cellColors: next, error: null };
}

export function addBlockSelection(selectedBlocks, index) {
  const set = new Set(selectedBlocks);
  set.add(index);
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
