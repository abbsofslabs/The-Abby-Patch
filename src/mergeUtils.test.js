import {
  cellsBetween,
  createEmptyPieceMergeIds,
  extractCutPieces,
  getAdjacentPieces,
  getMergedCellIndices,
  mergePieces,
  mergeSelectedBlocks,
  tileMergesFromSelection,
  unmergeSelectedBlocks,
  validateMergeSelection,
} from './mergeUtils';

describe('mergeUtils', () => {
  test('validates a solid same-color rectangle', () => {
    const cellColors = Array(9).fill(null);
    cellColors[0] = '#ff0000';
    cellColors[1] = '#ff0000';
    cellColors[3] = '#ff0000';
    cellColors[4] = '#ff0000';

    const result = validateMergeSelection(cellColors, [0, 1, 3, 4], 3);
    expect(result.ok).toBe(true);
    expect(result.rectangle.width).toBe(2);
    expect(result.rectangle.height).toBe(2);
  });

  test('rejects non-rectangular selections', () => {
    const cellColors = Array(9).fill('#00ff00');
    const result = validateMergeSelection(cellColors, [0, 1, 2, 4], 3);
    expect(result.ok).toBe(false);
  });

  test('merges and unmerges selected blocks', () => {
    const cellColors = Array(9).fill(null);
    cellColors[0] = '#0000ff';
    cellColors[1] = '#0000ff';
    const merges = {};
    const cellMergeIds = Array(9).fill(null);

    const merged = mergeSelectedBlocks(cellColors, [0, 1], 3, merges, cellMergeIds);
    expect(merged.ok).toBe(true);
    expect(Object.keys(merged.merges)).toHaveLength(1);
    expect(merged.cellMergeIds[0]).not.toBeNull();
    expect(merged.cellMergeIds[1]).not.toBeNull();

    const unmerged = unmergeSelectedBlocks([0], merged.merges, merged.cellMergeIds);
    expect(unmerged.ok).toBe(true);
    expect(Object.keys(unmerged.merges)).toHaveLength(0);
    expect(unmerged.cellMergeIds[0]).toBeNull();
  });

  test('getMergedCellIndices returns all cells in a merge', () => {
    const cellColors = Array(9).fill('#ff00ff');
    const merged = mergeSelectedBlocks(cellColors, [0, 1, 3, 4], 3, {}, Array(9).fill(null));
    const indices = getMergedCellIndices(4, merged.merges, merged.cellMergeIds);
    expect(indices).toEqual([0, 1, 3, 4]);
  });

  test('tileMergesFromSelection repeats merge pattern across grid', () => {
    const cellColors = Array(16).fill('#112233');
    const merged = mergeSelectedBlocks(cellColors, [0, 1], 4, {}, Array(16).fill(null));
    const tiled = tileMergesFromSelection(merged.merges, 4, 4, 0, 0, 2, 2);

    expect(Object.keys(tiled.merges)).toHaveLength(4);
    expect(tiled.cellMergeIds[0]).toBe(tiled.cellMergeIds[1]);
    expect(tiled.cellMergeIds[2]).toBe(tiled.cellMergeIds[3]);
    expect(tiled.cellMergeIds[8]).toBe(tiled.cellMergeIds[9]);
  });

  test('extractCutPieces uses outer finished dimensions for merges', () => {
    const cellColors = Array(4).fill('#aabbcc');
    const mergeResult = mergeSelectedBlocks(cellColors, [0, 1], 2, {}, Array(4).fill(null));
    const pieces = extractCutPieces(cellColors, mergeResult.merges, 6, 6);

    expect(pieces).toHaveLength(3);
    const mergedPiece = pieces.find((piece) => piece.gridWidth === 2);
    expect(mergedPiece.finishedWidth).toBe(12);
    expect(mergedPiece.finishedHeight).toBe(6);
  });

  test('merges a triangle half with an adjacent square', () => {
    const cellColors = Array(4).fill(null);
    const cellColorsB = Array(4).fill(null);
    const cellDiagonals = Array(4).fill(null);
    cellColors[0] = '#c45c26';
    cellColorsB[0] = '#eeeeee';
    cellDiagonals[0] = 'nwse';
    cellColors[1] = '#c45c26';

    const adjacent = getAdjacentPieces(0, 'a', 2, 2, cellDiagonals);
    expect(adjacent).toEqual(
      expect.arrayContaining([
        { index: 0, half: 'b' },
        { index: 1, half: null },
      ])
    );

    const merged = mergePieces(
      [
        { index: 0, half: 'a' },
        { index: 1, half: null },
      ],
      cellColors,
      cellColorsB,
      cellDiagonals,
      2,
      2,
      {},
      createEmptyPieceMergeIds(4)
    );

    expect(merged.ok).toBe(true);
    expect(merged.pieceMergeIds[0].a).toBe(merged.pieceMergeIds[1].a);
    expect(merged.pieceMergeIds[0].b).toBeNull();
    expect(merged.merges[merged.pieceMergeIds[0].a].pieces).toHaveLength(2);
  });

  test('merges two touching triangle halves across cells', () => {
    const cellColors = ['#224466', '#ffffff', null, null];
    const cellColorsB = ['#ffffff', '#224466', null, null];
    const cellDiagonals = ['nwse', 'nwse', null, null];

    // Cell 0 half A owns the right edge; cell 1 half B owns the left edge.
    const adjacent = getAdjacentPieces(0, 'a', 2, 2, cellDiagonals);
    expect(adjacent).toEqual(expect.arrayContaining([{ index: 1, half: 'b' }]));

    const merged = mergePieces(
      [
        { index: 0, half: 'a' },
        { index: 1, half: 'b' },
      ],
      cellColors,
      cellColorsB,
      cellDiagonals,
      2,
      2,
      {},
      createEmptyPieceMergeIds(4)
    );

    expect(merged.ok).toBe(true);
    expect(merged.pieceMergeIds[0].a).toBe(merged.pieceMergeIds[1].b);
    expect(merged.pieceMergeIds[0].b).toBeNull();
    expect(merged.pieceMergeIds[1].a).toBeNull();
  });

  test('extractCutPieces lists each triangle half with seam-ready dimensions', () => {
    const cellColors = ['#aa0000', null, null, null];
    const cellColorsB = ['#00aa00', null, null, null];
    const cellDiagonals = ['nwse', null, null, null];

    const pieces = extractCutPieces(cellColors, {}, 6, 6, {
      cellColorsB,
      cellDiagonals,
    });

    expect(pieces).toHaveLength(2);
    expect(pieces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: '#aa0000',
          shape: 'triangle',
          finishedWidth: 6,
          finishedHeight: 6,
        }),
        expect.objectContaining({
          color: '#00aa00',
          shape: 'triangle',
          finishedWidth: 6,
          finishedHeight: 6,
        }),
      ])
    );
  });

  test('extractCutPieces keeps unmerged triangle half when the other half is merged', () => {
    const cellColors = ['#aa0000', '#aa0000', null, null];
    const cellColorsB = ['#00aa00', null, null, null];
    const cellDiagonals = ['nwse', null, null, null];
    const merged = mergePieces(
      [
        { index: 0, half: 'a' },
        { index: 1, half: null },
      ],
      cellColors,
      cellColorsB,
      cellDiagonals,
      2,
      2,
      {},
      createEmptyPieceMergeIds(4)
    );

    const pieces = extractCutPieces(cellColors, merged.merges, 6, 6, {
      cellColorsB,
      cellDiagonals,
    });

    expect(pieces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: '#aa0000', shape: 'rect' }),
        expect.objectContaining({ color: '#00aa00', shape: 'triangle' }),
      ])
    );
    expect(pieces).toHaveLength(2);
  });

  test('rejects merging disconnected same-color pieces', () => {
    const cellColors = ['#112233', null, null, '#112233'];
    const result = mergePieces(
      [
        { index: 0, half: null },
        { index: 3, half: null },
      ],
      cellColors,
      Array(4).fill(null),
      Array(4).fill(null),
      2,
      2,
      {},
      createEmptyPieceMergeIds(4)
    );

    expect(result.ok).toBe(false);
  });

  test('cellsBetween walks the straight line between grid cells', () => {
    // 4-column grid: 0 → 3 across the top row.
    expect(cellsBetween(0, 3, 4)).toEqual([1, 2, 3]);
    // Vertical: 1 → 13 in a 4-column grid.
    expect(cellsBetween(1, 13, 4)).toEqual([5, 9, 13]);
    // Same cell: nothing between.
    expect(cellsBetween(6, 6, 4)).toEqual([]);
  });
});
