import {
  extractCutPieces,
  getMergedCellIndices,
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
});
