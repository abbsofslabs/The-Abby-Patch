export function indexToRowCol(index, columns) {
  return {
    row: Math.floor(index / columns),
    col: index % columns,
  };
}

export function rowColToIndex(row, col, columns) {
  return row * columns + col;
}

export function createEmptyPieceMergeIds(cellCount) {
  return Array.from({ length: cellCount }, () => ({ a: null, b: null }));
}

export function pieceKey(index, half) {
  return `${index}:${half || 'full'}`;
}

export function parsePieceKey(key) {
  const [indexPart, halfPart] = key.split(':');
  return {
    index: Number(indexPart),
    half: halfPart === 'full' ? null : halfPart,
  };
}

/** Which outer/diag edges a piece exposes. */
export function getPieceEdges(diagonal, half) {
  if (!diagonal || half == null) {
    return ['top', 'bottom', 'left', 'right'];
  }
  if (diagonal === 'nwse') {
    return half === 'a' ? ['top', 'right', 'diag'] : ['bottom', 'left', 'diag'];
  }
  return half === 'a' ? ['top', 'left', 'diag'] : ['bottom', 'right', 'diag'];
}

export function getPieceColor(cellColors, cellColorsB, cellDiagonals, index, half) {
  if (cellDiagonals?.[index] && half === 'b') {
    return cellColorsB?.[index] ?? null;
  }
  return cellColors?.[index] ?? null;
}

function oppositeEdge(edge) {
  if (edge === 'top') return 'bottom';
  if (edge === 'bottom') return 'top';
  if (edge === 'left') return 'right';
  if (edge === 'right') return 'left';
  return 'diag';
}

function neighborIndex(index, edge, columns, rows) {
  const { row, col } = indexToRowCol(index, columns);
  if (edge === 'top' && row > 0) {
    return rowColToIndex(row - 1, col, columns);
  }
  if (edge === 'bottom' && row < rows - 1) {
    return rowColToIndex(row + 1, col, columns);
  }
  if (edge === 'left' && col > 0) {
    return rowColToIndex(row, col - 1, columns);
  }
  if (edge === 'right' && col < columns - 1) {
    return rowColToIndex(row, col + 1, columns);
  }
  return null;
}

function halvesTouchingEdge(diagonal, edge) {
  if (!diagonal) {
    return [null];
  }
  return ['a', 'b'].filter((half) => getPieceEdges(diagonal, half).includes(edge));
}

export function getAdjacentPieces(index, half, columns, rows, cellDiagonals) {
  const diagonal = cellDiagonals?.[index] ?? null;
  const resolvedHalf = diagonal ? half || 'a' : null;
  const edges = getPieceEdges(diagonal, resolvedHalf);
  const adjacent = [];

  edges.forEach((edge) => {
    if (edge === 'diag') {
      const other = resolvedHalf === 'a' ? 'b' : 'a';
      adjacent.push({ index, half: other });
      return;
    }

    const nextIndex = neighborIndex(index, edge, columns, rows);
    if (nextIndex == null) {
      return;
    }

    const neighborDiagonal = cellDiagonals?.[nextIndex] ?? null;
    const shared = oppositeEdge(edge);
    halvesTouchingEdge(neighborDiagonal, shared).forEach((neighborHalf) => {
      adjacent.push({ index: nextIndex, half: neighborHalf });
    });
  });

  return adjacent;
}

export function arePiecesConnected(pieces, columns, rows, cellDiagonals) {
  if (pieces.length <= 1) {
    return true;
  }

  const keySet = new Set(pieces.map((piece) => pieceKey(piece.index, piece.half)));
  const start = pieceKey(pieces[0].index, pieces[0].half);
  const visited = new Set([start]);
  const queue = [start];

  while (queue.length) {
    const current = parsePieceKey(queue.shift());
    getAdjacentPieces(
      current.index,
      current.half,
      columns,
      rows,
      cellDiagonals
    ).forEach((neighbor) => {
      const key = pieceKey(neighbor.index, neighbor.half);
      if (keySet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(key);
      }
    });
  }

  return visited.size === keySet.size;
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

function syncCellMergeIds(pieceMergeIds) {
  return pieceMergeIds.map(({ a, b }) => {
    if (a != null && a === b) {
      return a;
    }
    if (a != null && b == null) {
      return a;
    }
    if (b != null && a == null) {
      return b;
    }
    return null;
  });
}

function clonePieceMergeIds(pieceMergeIds) {
  return pieceMergeIds.map(({ a, b }) => ({ a, b }));
}

export function dissolveMerge(merges, cellMergeIds, mergeId, pieceMergeIds = null) {
  const merge = merges[mergeId];
  if (!merge) {
    return {
      merges,
      cellMergeIds,
      pieceMergeIds: pieceMergeIds ? clonePieceMergeIds(pieceMergeIds) : pieceMergeIds,
    };
  }

  const nextMerges = { ...merges };
  delete nextMerges[mergeId];

  const nextPieceMergeIds = pieceMergeIds
    ? clonePieceMergeIds(pieceMergeIds)
    : createEmptyPieceMergeIds(cellMergeIds.length);

  if (merge.pieces?.length) {
    merge.pieces.forEach(({ index, half }) => {
      if (half === 'b') {
        if (nextPieceMergeIds[index].b === mergeId) {
          nextPieceMergeIds[index] = { ...nextPieceMergeIds[index], b: null };
        }
      } else if (half === 'a') {
        if (nextPieceMergeIds[index].a === mergeId) {
          nextPieceMergeIds[index] = { ...nextPieceMergeIds[index], a: null };
        }
      } else {
        nextPieceMergeIds[index] = { a: null, b: null };
      }
    });
  } else {
    (merge.cells || []).forEach((index) => {
      nextPieceMergeIds[index] = { a: null, b: null };
    });
  }

  return {
    merges: nextMerges,
    cellMergeIds: syncCellMergeIds(nextPieceMergeIds),
    pieceMergeIds: nextPieceMergeIds,
  };
}

export function getPieceMergeId(index, half, pieceMergeIds, cellDiagonals) {
  const ids = pieceMergeIds?.[index] || { a: null, b: null };
  if (cellDiagonals?.[index] && half === 'b') {
    return ids.b;
  }
  if (cellDiagonals?.[index] && half === 'a') {
    return ids.a;
  }
  return ids.a ?? ids.b;
}

export function getMergedPieces(
  index,
  half,
  merges,
  pieceMergeIds,
  cellDiagonals
) {
  const resolvedHalf = cellDiagonals?.[index] ? half || 'a' : null;
  const mergeId = getPieceMergeId(index, resolvedHalf, pieceMergeIds, cellDiagonals);
  if (mergeId == null || !merges[mergeId]) {
    return [{ index, half: resolvedHalf }];
  }
  return merges[mergeId].pieces;
}

export function getMergedCellIndices(index, merges, cellMergeIds, pieceMergeIds = null) {
  if (pieceMergeIds) {
    const ids = pieceMergeIds[index] || { a: null, b: null };
    const mergeIds = [...new Set([ids.a, ids.b].filter((id) => id != null))];
    if (!mergeIds.length) {
      return [index];
    }
    const cells = new Set();
    mergeIds.forEach((mergeId) => {
      const merge = merges[mergeId];
      if (!merge) {
        return;
      }
      (merge.cells || merge.pieces?.map((piece) => piece.index) || []).forEach((cellIndex) => {
        cells.add(cellIndex);
      });
    });
    return [...cells].sort((a, b) => a - b);
  }

  const mergeId = cellMergeIds[index];
  if (mergeId == null || !merges[mergeId]) {
    return [index];
  }
  return merges[mergeId].cells;
}

export function expandIndicesToWholeMerges(indices, merges, cellMergeIds, pieceMergeIds = null) {
  const expanded = new Set();
  indices.forEach((index) => {
    getMergedCellIndices(index, merges, cellMergeIds, pieceMergeIds).forEach((cellIndex) => {
      expanded.add(cellIndex);
    });
  });
  return [...expanded].sort((a, b) => a - b);
}

/** Grid cells on the straight line from cell a to cell b (excludes a, includes b). */
export function cellsBetween(a, b, columns) {
  const cells = [];
  let { row: r, col: c } = indexToRowCol(a, columns);
  const { row: r1, col: c1 } = indexToRowCol(b, columns);
  const dr = Math.abs(r1 - r);
  const dc = Math.abs(c1 - c);
  const sr = r < r1 ? 1 : -1;
  const sc = c < c1 ? 1 : -1;
  let err = dc - dr;

  while (!(r === r1 && c === c1)) {
    const e2 = 2 * err;
    if (e2 > -dr) {
      err -= dr;
      c += sc;
    }
    if (e2 < dc) {
      err += dc;
      r += sr;
    }
    cells.push(rowColToIndex(r, c, columns));
  }

  return cells;
}

export function dissolveMergesTouchingPieces(merges, pieceMergeIds, pieces) {
  const mergeIds = new Set();
  pieces.forEach(({ index, half }) => {
    const ids = pieceMergeIds[index] || { a: null, b: null };
    if (half === 'b') {
      if (ids.b != null) mergeIds.add(ids.b);
    } else if (half === 'a') {
      if (ids.a != null) mergeIds.add(ids.a);
    } else {
      if (ids.a != null) mergeIds.add(ids.a);
      if (ids.b != null) mergeIds.add(ids.b);
    }
  });

  let nextMerges = merges;
  let nextPieceMergeIds = pieceMergeIds;
  let nextCellMergeIds = syncCellMergeIds(pieceMergeIds);

  mergeIds.forEach((mergeId) => {
    const dissolved = dissolveMerge(nextMerges, nextCellMergeIds, mergeId, nextPieceMergeIds);
    nextMerges = dissolved.merges;
    nextPieceMergeIds = dissolved.pieceMergeIds;
    nextCellMergeIds = dissolved.cellMergeIds;
  });

  return {
    merges: nextMerges,
    pieceMergeIds: nextPieceMergeIds,
    cellMergeIds: nextCellMergeIds,
  };
}

export function dissolveMergesTouchingIndices(merges, cellMergeIds, indices, pieceMergeIds = null) {
  const pieces = indices.map((index) => ({ index, half: null }));
  const ids =
    pieceMergeIds ||
    cellMergeIds.map((mergeId) => ({
      a: mergeId,
      b: mergeId,
    }));
  return dissolveMergesTouchingPieces(merges, ids, pieces);
}

export function validatePieceMerge(
  pieces,
  cellColors,
  cellColorsB,
  cellDiagonals,
  columns,
  rows
) {
  if (pieces.length < 2) {
    return { ok: false, message: 'Select at least two shapes to merge.' };
  }

  const colors = pieces.map((piece) =>
    getPieceColor(cellColors, cellColorsB, cellDiagonals, piece.index, piece.half)
  );

  if (colors.some((color) => !color)) {
    return { ok: false, message: 'Empty shapes cannot be merged.' };
  }

  const unique = new Set(colors.map((color) => color.toLowerCase()));
  if (unique.size !== 1) {
    return { ok: false, message: 'All shapes must be the same color to merge.' };
  }

  if (!arePiecesConnected(pieces, columns, rows, cellDiagonals)) {
    return { ok: false, message: 'Merged shapes must touch along an edge.' };
  }

  return { ok: true, color: colors[0] };
}

export function mergePieces(
  pieces,
  cellColors,
  cellColorsB,
  cellDiagonals,
  columns,
  rows,
  merges,
  pieceMergeIds
) {
  const uniqueKeys = new Set();
  const uniquePieces = [];
  pieces.forEach((piece) => {
    const key = pieceKey(piece.index, piece.half);
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniquePieces.push({
        index: piece.index,
        half: cellDiagonals?.[piece.index] ? piece.half || 'a' : null,
      });
    }
  });

  const validation = validatePieceMerge(
    uniquePieces,
    cellColors,
    cellColorsB,
    cellDiagonals,
    columns,
    rows
  );
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const cleared = dissolveMergesTouchingPieces(merges, pieceMergeIds, uniquePieces);
  const nextMerges = { ...cleared.merges };
  const nextPieceMergeIds = clonePieceMergeIds(cleared.pieceMergeIds);
  const mergeId = createMergeId(nextMerges);
  const cells = [...new Set(uniquePieces.map((piece) => piece.index))].sort((a, b) => a - b);

  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  cells.forEach((index) => {
    const { row, col } = indexToRowCol(index, columns);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  });

  nextMerges[mergeId] = {
    id: mergeId,
    color: validation.color,
    pieces: uniquePieces,
    cells,
    minRow,
    minCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };

  uniquePieces.forEach(({ index, half }) => {
    if (half === 'b') {
      nextPieceMergeIds[index] = { ...nextPieceMergeIds[index], b: mergeId };
    } else if (half === 'a') {
      nextPieceMergeIds[index] = { ...nextPieceMergeIds[index], a: mergeId };
    } else {
      nextPieceMergeIds[index] = { a: mergeId, b: mergeId };
    }
  });

  return {
    ok: true,
    merges: nextMerges,
    pieceMergeIds: nextPieceMergeIds,
    cellMergeIds: syncCellMergeIds(nextPieceMergeIds),
  };
}

export function mergeSelectedBlocks(
  cellColors,
  selectedIndices,
  columns,
  merges,
  cellMergeIds,
  options = {}
) {
  const {
    cellColorsB = Array(cellColors.length).fill(null),
    cellDiagonals = Array(cellColors.length).fill(null),
    pieceMergeIds = createEmptyPieceMergeIds(cellColors.length),
    rows = Math.ceil(cellColors.length / columns),
  } = options;

  const validation = validateMergeSelection(cellColors, selectedIndices, columns);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const pieces = validation.rectangle.cells.map((index) => ({ index, half: null }));
  return mergePieces(
    pieces,
    cellColors,
    cellColorsB,
    cellDiagonals,
    columns,
    rows,
    merges,
    pieceMergeIds
  );
}

export function unmergeSelectedBlocks(
  selectedIndices,
  merges,
  cellMergeIds,
  pieceMergeIds = null
) {
  const ids = pieceMergeIds || createEmptyPieceMergeIds(cellMergeIds.length);
  const mergeIds = new Set();

  selectedIndices.forEach((index) => {
    const pieceIds = ids[index] || { a: null, b: null };
    if (pieceIds.a != null) mergeIds.add(pieceIds.a);
    if (pieceIds.b != null) mergeIds.add(pieceIds.b);
    if (cellMergeIds[index] != null) mergeIds.add(cellMergeIds[index]);
  });

  if (!mergeIds.size) {
    return { ok: false, message: 'Select a merged block to unmerge.' };
  }

  let nextMerges = merges;
  let nextPieceMergeIds = clonePieceMergeIds(ids);
  let nextCellMergeIds = [...cellMergeIds];

  mergeIds.forEach((mergeId) => {
    const dissolved = dissolveMerge(nextMerges, nextCellMergeIds, mergeId, nextPieceMergeIds);
    nextMerges = dissolved.merges;
    nextPieceMergeIds = dissolved.pieceMergeIds;
    nextCellMergeIds = dissolved.cellMergeIds;
  });

  return {
    ok: true,
    merges: nextMerges,
    cellMergeIds: nextCellMergeIds,
    pieceMergeIds: nextPieceMergeIds,
  };
}

function pieceInMerge(pieceMergeIds, index, half, mergeId) {
  const ids = pieceMergeIds[index] || { a: null, b: null };
  if (half === 'b') {
    return ids.b === mergeId;
  }
  if (half === 'a') {
    return ids.a === mergeId;
  }
  return ids.a === mergeId || ids.b === mergeId;
}

export function getMergeBorders(
  index,
  columns,
  merges,
  cellMergeIds,
  options = {}
) {
  const {
    rows = null,
    pieceMergeIds = null,
    cellDiagonals = null,
  } = options;

  if (!pieceMergeIds) {
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
      hideDiagonal: false,
      isAnchor: row === merge.minRow && col === merge.minCol,
      mergeWidth: merge.width,
      mergeHeight: merge.height,
      pieceCount: merge.pieces?.length || merge.cells?.length || 0,
    };
  }

  const ids = pieceMergeIds[index] || { a: null, b: null };
  const mergeIds = [...new Set([ids.a, ids.b].filter((id) => id != null))];
  if (!mergeIds.length) {
    const diagonal = cellDiagonals?.[index] ?? null;
    return {
      hideTop: false,
      hideBottom: false,
      hideLeft: false,
      hideRight: false,
      hideDiagonal: false,
      isAnchor: false,
      mergeWidth: 1,
      mergeHeight: 1,
      pieceCount: 0,
      showDiagonal: Boolean(diagonal),
    };
  }

  const primaryMergeId = ids.a ?? ids.b;
  const merge = merges[primaryMergeId];
  const rowCount = rows || Math.max(...Object.values(merges).map((item) => item.minRow + item.height));
  const diagonal = cellDiagonals?.[index] ?? null;

  const edgeHidden = (edge) => {
    const localHalves = halvesTouchingEdge(diagonal, edge);
    const nextIndex = neighborIndex(index, edge, columns, rowCount);
    if (nextIndex == null) {
      return false;
    }
    const neighborDiagonal = cellDiagonals?.[nextIndex] ?? null;
    const shared = oppositeEdge(edge);
    const neighborHalves = halvesTouchingEdge(neighborDiagonal, shared);

    return localHalves.some((half) => {
      const localMergeId = half === 'b' ? ids.b : half === 'a' ? ids.a : ids.a ?? ids.b;
      if (localMergeId == null) {
        return false;
      }
      return neighborHalves.some((neighborHalf) =>
        pieceInMerge(pieceMergeIds, nextIndex, neighborHalf, localMergeId)
      );
    });
  };

  const hideDiagonal =
    Boolean(diagonal) && ids.a != null && ids.a === ids.b && ids.a === primaryMergeId;

  const anchorIndex = Math.min(...(merge?.cells || [index]));

  return {
    hideTop: edgeHidden('top'),
    hideBottom: edgeHidden('bottom'),
    hideLeft: edgeHidden('left'),
    hideRight: edgeHidden('right'),
    hideDiagonal,
    isAnchor: index === anchorIndex,
    mergeWidth: merge?.width || 1,
    mergeHeight: merge?.height || 1,
    pieceCount: merge?.pieces?.length || merge?.cells?.length || 0,
    showDiagonal: Boolean(diagonal) && !hideDiagonal,
  };
}

export function tileMergesFromSelection(
  merges,
  rows,
  columns,
  minRow,
  minCol,
  patternWidth,
  patternHeight
) {
  const patternMerges = Object.values(merges).filter(
    (merge) =>
      merge.minRow >= minRow &&
      merge.minRow + merge.height <= minRow + patternHeight &&
      merge.minCol >= minCol &&
      merge.minCol + merge.width <= minCol + patternWidth
  );

  const cellCount = rows * columns;
  const nextPieceMergeIds = createEmptyPieceMergeIds(cellCount);
  const nextMerges = {};
  let nextId = 1;

  patternMerges.forEach((merge) => {
    const relMinRow = merge.minRow - minRow;
    const relMinCol = merge.minCol - minCol;

    for (let row = 0; row < rows; row += 1) {
      const rowOffset = ((row - minRow) % patternHeight + patternHeight) % patternHeight;
      if (rowOffset !== relMinRow) {
        continue;
      }

      for (let col = 0; col < columns; col += 1) {
        const colOffset = ((col - minCol) % patternWidth + patternWidth) % patternWidth;
        if (colOffset !== relMinCol) {
          continue;
        }

        if (row + merge.height > rows || col + merge.width > columns) {
          continue;
        }

        const sourcePieces =
          merge.pieces ||
          (merge.cells || []).map((cellIndex) => ({ index: cellIndex, half: null }));

        const resolvedPieces = sourcePieces.map((piece) => {
          const { row: pieceRow, col: pieceCol } = indexToRowCol(piece.index, columns);
          const relRow = pieceRow - merge.minRow;
          const relCol = pieceCol - merge.minCol;
          return {
            index: (row + relRow) * columns + (col + relCol),
            half: piece.half ?? null,
          };
        });

        const cells = [...new Set(resolvedPieces.map((piece) => piece.index))].sort(
          (a, b) => a - b
        );

        const mergeId = nextId;
        nextId += 1;

        nextMerges[mergeId] = {
          id: mergeId,
          minRow: row,
          minCol: col,
          width: merge.width,
          height: merge.height,
          color: merge.color,
          cells,
          pieces: resolvedPieces,
        };
        resolvedPieces.forEach(({ index: pieceIndex, half }) => {
          if (half === 'b') {
            nextPieceMergeIds[pieceIndex] = {
              ...nextPieceMergeIds[pieceIndex],
              b: mergeId,
            };
          } else if (half === 'a') {
            nextPieceMergeIds[pieceIndex] = {
              ...nextPieceMergeIds[pieceIndex],
              a: mergeId,
            };
          } else {
            nextPieceMergeIds[pieceIndex] = { a: mergeId, b: mergeId };
          }
        });
      }
    }
  });

  return {
    merges: nextMerges,
    cellMergeIds: syncCellMergeIds(nextPieceMergeIds),
    pieceMergeIds: nextPieceMergeIds,
  };
}

export function extractCutPieces(
  cellColors,
  merges,
  cellFinishedWidth,
  cellFinishedHeight,
  options = {}
) {
  const {
    cellColorsB = Array(cellColors.length).fill(null),
    cellDiagonals = Array(cellColors.length).fill(null),
  } = options;

  const covered = new Set();
  const pieces = [];

  Object.values(merges).forEach((merge) => {
    if (!merge.color) {
      return;
    }

    const mergePieces =
      merge.pieces ||
      (merge.cells || []).map((index) => ({ index, half: null }));

    mergePieces.forEach((piece) => {
      covered.add(pieceKey(piece.index, piece.half));
    });

    const dims = getMergeCutDimensions(
      merge,
      cellFinishedWidth,
      cellFinishedHeight,
      cellDiagonals
    );

    pieces.push({
      color: merge.color.toLowerCase(),
      finishedWidth: dims.finishedWidth,
      finishedHeight: dims.finishedHeight,
      gridWidth: dims.gridWidth,
      gridHeight: dims.gridHeight,
      shape: dims.shape,
    });
  });

  cellColors.forEach((color, index) => {
    const diagonal = cellDiagonals[index] ?? null;

    if (diagonal) {
      if (color && !covered.has(pieceKey(index, 'a'))) {
        pieces.push({
          color: color.toLowerCase(),
          finishedWidth: cellFinishedWidth,
          finishedHeight: cellFinishedHeight,
          gridWidth: 1,
          gridHeight: 1,
          shape: 'triangle',
        });
      }

      const colorB = cellColorsB[index];
      if (colorB && !covered.has(pieceKey(index, 'b'))) {
        pieces.push({
          color: colorB.toLowerCase(),
          finishedWidth: cellFinishedWidth,
          finishedHeight: cellFinishedHeight,
          gridWidth: 1,
          gridHeight: 1,
          shape: 'triangle',
        });
      }
      return;
    }

    if (!color || covered.has(pieceKey(index, null))) {
      return;
    }

    pieces.push({
      color: color.toLowerCase(),
      finishedWidth: cellFinishedWidth,
      finishedHeight: cellFinishedHeight,
      gridWidth: 1,
      gridHeight: 1,
      shape: 'rect',
    });
  });

  return pieces;
}

function mergeCoversCellFully(mergePieces, index, cellDiagonals) {
  const halves = mergePieces.filter((piece) => piece.index === index);
  if (!halves.length) {
    return false;
  }
  if (!cellDiagonals?.[index]) {
    return halves.some((piece) => piece.half == null);
  }
  return (
    halves.some((piece) => piece.half === 'a') &&
    halves.some((piece) => piece.half === 'b')
  );
}

function getMergeCutDimensions(merge, cellFinishedWidth, cellFinishedHeight, cellDiagonals) {
  const mergePieces =
    merge.pieces || (merge.cells || []).map((index) => ({ index, half: null }));

  if (
    mergePieces.length === 1 &&
    mergePieces[0].half != null &&
    cellDiagonals?.[mergePieces[0].index]
  ) {
    return {
      finishedWidth: cellFinishedWidth,
      finishedHeight: cellFinishedHeight,
      gridWidth: 1,
      gridHeight: 1,
      shape: 'triangle',
    };
  }

  if (
    mergePieces.length === 2 &&
    mergePieces[0].index === mergePieces[1].index &&
    mergePieces[0].half != null &&
    mergePieces[1].half != null &&
    mergePieces[0].half !== mergePieces[1].half
  ) {
    return {
      finishedWidth: cellFinishedWidth,
      finishedHeight: cellFinishedHeight,
      gridWidth: 1,
      gridHeight: 1,
      shape: 'rect',
    };
  }

  const cells = [...new Set(mergePieces.map((piece) => piece.index))];
  const expected = merge.width * merge.height;
  const fullyCovered =
    cells.length === expected &&
    cells.every((index) => mergeCoversCellFully(mergePieces, index, cellDiagonals));

  if (fullyCovered) {
    return {
      finishedWidth: merge.width * cellFinishedWidth,
      finishedHeight: merge.height * cellFinishedHeight,
      gridWidth: merge.width,
      gridHeight: merge.height,
      shape: 'rect',
    };
  }

  // Irregular or partial-cell merges: use bounding box for cut planning.
  return {
    finishedWidth: merge.width * cellFinishedWidth,
    finishedHeight: merge.height * cellFinishedHeight,
    gridWidth: merge.width,
    gridHeight: merge.height,
    shape: 'rect',
  };
}
