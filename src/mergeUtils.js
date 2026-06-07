export function indexToRowCol(index, columns) {
  return {
    row: Math.floor(index / columns),
    col: index % columns,
  };
}

export function rowColToIndex(row, col, columns) {
  return row * columns + col;
}

export function getSelectionRectangle(selectedIndices, columns) {
  if (!selectedIndices.length) {
    return null;
  }

  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;

  selectedIndices.forEach((index) => {
    const { row, col } = indexToRowCol(index, columns);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  });

  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const expectedCells = width * height;

  if (selectedIndices.length !== expectedCells) {
    return null;
  }

  const cells = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push(rowColToIndex(row, col, columns));
    }
  }

  return { minRow, minCol, width, height, cells };
}

export function validateMergeSelection(cellColors, selectedIndices, columns) {
  if (selectedIndices.length < 2) {
    return { ok: false, message: 'Select at least two blocks to merge.' };
  }

  const rectangle = getSelectionRectangle(selectedIndices, columns);
  if (!rectangle) {
    return { ok: false, message: 'Merged blocks must form a solid rectangle.' };
  }

  const colors = new Set(
    rectangle.cells.map((index) => cellColors[index]?.toLowerCase()).filter(Boolean)
  );

  if (colors.size !== 1) {
    return { ok: false, message: 'All selected blocks must be the same color to merge.' };
  }

  if (rectangle.cells.some((index) => !cellColors[index])) {
    return { ok: false, message: 'Empty blocks cannot be merged.' };
  }

  return { ok: true, rectangle, color: cellColors[rectangle.cells[0]] };
}

function createMergeId(merges) {
  let id = 1;
  while (merges[id]) {
    id += 1;
  }
  return id;
}

export function dissolveMerge(merges, cellMergeIds, mergeId) {
  const merge = merges[mergeId];
  if (!merge) {
    return { merges, cellMergeIds };
  }

  const nextMerges = { ...merges };
  delete nextMerges[mergeId];

  const nextCellMergeIds = [...cellMergeIds];
  merge.cells.forEach((index) => {
    nextCellMergeIds[index] = null;
  });

  return { merges: nextMerges, cellMergeIds: nextCellMergeIds };
}

export function dissolveMergesTouchingIndices(merges, cellMergeIds, indices) {
  const mergeIds = new Set(
    indices.map((index) => cellMergeIds[index]).filter((id) => id != null)
  );

  let next = { merges, cellMergeIds };
  mergeIds.forEach((mergeId) => {
    next = dissolveMerge(next.merges, next.cellMergeIds, mergeId);
  });
  return next;
}

export function mergeSelectedBlocks(cellColors, selectedIndices, columns, merges, cellMergeIds) {
  const validation = validateMergeSelection(cellColors, selectedIndices, columns);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const { rectangle, color } = validation;
  let nextMerges = { ...merges };
  let nextCellMergeIds = [...cellMergeIds];

  const cleared = dissolveMergesTouchingIndices(nextMerges, nextCellMergeIds, rectangle.cells);
  nextMerges = cleared.merges;
  nextCellMergeIds = cleared.cellMergeIds;

  const mergeId = createMergeId(nextMerges);
  nextMerges[mergeId] = {
    id: mergeId,
    minRow: rectangle.minRow,
    minCol: rectangle.minCol,
    width: rectangle.width,
    height: rectangle.height,
    color,
    cells: rectangle.cells,
  };

  rectangle.cells.forEach((index) => {
    nextCellMergeIds[index] = mergeId;
  });

  return {
    ok: true,
    merges: nextMerges,
    cellMergeIds: nextCellMergeIds,
  };
}

export function unmergeSelectedBlocks(selectedIndices, merges, cellMergeIds) {
  const mergeIds = new Set(
    selectedIndices.map((index) => cellMergeIds[index]).filter((id) => id != null)
  );

  if (!mergeIds.size) {
    return { ok: false, message: 'Select a merged block to unmerge.' };
  }

  let nextMerges = { ...merges };
  let nextCellMergeIds = [...cellMergeIds];
  mergeIds.forEach((mergeId) => {
    const dissolved = dissolveMerge(nextMerges, nextCellMergeIds, mergeId);
    nextMerges = dissolved.merges;
    nextCellMergeIds = dissolved.cellMergeIds;
  });

  return { ok: true, merges: nextMerges, cellMergeIds: nextCellMergeIds };
}

export function getMergeBorders(index, columns, merges, cellMergeIds) {
  const mergeId = cellMergeIds[index];
  if (!mergeId || !merges[mergeId]) {
    return null;
  }

  const merge = merges[mergeId];
  const { row, col } = indexToRowCol(index, columns);

  return {
    hideTop: row > merge.minRow,
    hideBottom: row < merge.minRow + merge.height - 1,
    hideLeft: col > merge.minCol,
    hideRight: col < merge.minCol + merge.width - 1,
    isAnchor: row === merge.minRow && col === merge.minCol,
    mergeWidth: merge.width,
    mergeHeight: merge.height,
  };
}

export function extractCutPieces(cellColors, merges, cellFinishedWidth, cellFinishedHeight) {
  const covered = new Set();
  const pieces = [];

  Object.values(merges).forEach((merge) => {
    merge.cells.forEach((index) => covered.add(index));
    pieces.push({
      color: merge.color.toLowerCase(),
      finishedWidth: merge.width * cellFinishedWidth,
      finishedHeight: merge.height * cellFinishedHeight,
      gridWidth: merge.width,
      gridHeight: merge.height,
    });
  });

  cellColors.forEach((color, index) => {
    if (!color || covered.has(index)) {
      return;
    }
    pieces.push({
      color: color.toLowerCase(),
      finishedWidth: cellFinishedWidth,
      finishedHeight: cellFinishedHeight,
      gridWidth: 1,
      gridHeight: 1,
    });
  });

  return pieces;
}
