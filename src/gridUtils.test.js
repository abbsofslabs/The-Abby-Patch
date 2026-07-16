import {
  addBlockSelections,
  applyTileFromSelection,
  extractPatternSnapshot,
  getColoredBlockIndices,
  getColoredPieceKeys,
  normalizeSelectedPieces,
  removeBlockSelections,
  selectedPiecesToCellIndices,
} from './gridUtils';
import { mergePieces, mergeSelectedBlocks, createEmptyPieceMergeIds } from './mergeUtils';

test('tiles the selected pattern across the entire grid', () => {
  const rows = 4;
  const columns = 4;
  const cellColors = Array(16).fill(null);
  const selectedBlocks = [0, 1, 4, 5];

  cellColors[0] = '#ff0000';
  cellColors[1] = '#00ff00';
  cellColors[4] = '#00ff00';
  cellColors[5] = '#ff0000';

  const { cellColors: tiled, error } = applyTileFromSelection(
    cellColors,
    {},
    Array(16).fill(null),
    rows,
    columns,
    selectedBlocks
  );

  expect(error).toBeNull();
  expect(tiled[0]).toBe('#ff0000');
  expect(tiled[1]).toBe('#00ff00');
  expect(tiled[2]).toBe('#ff0000');
  expect(tiled[3]).toBe('#00ff00');
  expect(tiled[14]).toBe('#00ff00');
  expect(tiled[15]).toBe('#ff0000');
});

test('tiles merged regions across the entire grid', () => {
  const rows = 4;
  const columns = 4;
  const cellColors = Array(16).fill('#aabbcc');
  const mergeResult = mergeSelectedBlocks(cellColors, [0, 1], 4, {}, Array(16).fill(null));

  const { cellMergeIds, merges, error } = applyTileFromSelection(
    cellColors,
    mergeResult.merges,
    mergeResult.cellMergeIds,
    rows,
    columns,
    [0, 1, 4, 5]
  );

  expect(error).toBeNull();
  expect(Object.keys(merges).length).toBe(4);
  expect(cellMergeIds[0]).toBe(cellMergeIds[1]);
  expect(cellMergeIds[2]).toBe(cellMergeIds[3]);
  expect(cellMergeIds[8]).toBe(cellMergeIds[9]);
  expect(cellMergeIds[0]).not.toBe(cellMergeIds[2]);
});

test('getColoredBlockIndices returns only painted cells', () => {
  const cellColors = [null, '#ff0000', null, '#00ff00', '#00ff00'];
  expect(getColoredBlockIndices(cellColors)).toEqual([1, 3, 4]);
});

test('removeBlockSelections drops only the given indices', () => {
  expect(removeBlockSelections([0, 1, 2, 5], [1, 5])).toEqual([0, 2]);
});

test('add and remove block selections can toggle a block', () => {
  let selected = [];
  selected = addBlockSelections(selected, [3]);
  expect(selected).toEqual([3]);
  selected = removeBlockSelections(selected, [3]);
  expect(selected).toEqual([]);
});

test('returns an error when the selected pattern has no color', () => {
  const { error } = applyTileFromSelection(
    Array(16).fill(null),
    {},
    Array(16).fill(null),
    4,
    4,
    [0, 1, 4, 5]
  );

  expect(error).toBe('no_motif');
});

test('pattern snapshot keeps full-cell and triangle-half merges', () => {
  const cellColors = Array(16).fill('#123456');
  const cellColorsB = Array(16).fill(null);
  const cellDiagonals = Array(16).fill(null);
  cellColorsB[0] = '#abcdef';
  cellDiagonals[0] = 'nwse';

  const fullMerge = mergeSelectedBlocks(cellColors, [4, 5], 4, {}, Array(16).fill(null));
  const halfMerge = mergePieces(
    [
      { index: 0, half: 'a' },
      { index: 1, half: null },
    ],
    cellColors,
    cellColorsB,
    cellDiagonals,
    4,
    4,
    fullMerge.merges,
    fullMerge.pieceMergeIds
  );

  const snapshot = extractPatternSnapshot(
    cellColors,
    halfMerge.merges,
    halfMerge.cellMergeIds,
    4,
    [0, 1, 4, 5],
    { cellColorsB, cellDiagonals }
  );

  expect(snapshot.error).toBeNull();
  expect(snapshot.patternDiagonals[0]).toBe('nwse');
  expect(snapshot.patternB[0]).toBe('#abcdef');
  const copied = Object.values(snapshot.merges);
  expect(copied).toHaveLength(2);
  expect(copied.some((merge) => merge.pieces?.some((piece) => piece.half === 'a'))).toBe(
    true
  );
});

test('paste tiles triangles and triangle-half merges across the grid', () => {
  const cellColors = Array(16).fill(null);
  const cellColorsB = Array(16).fill(null);
  const cellDiagonals = Array(16).fill(null);
  cellColors[0] = '#aa0000';
  cellColorsB[0] = '#00aa00';
  cellDiagonals[0] = 'nwse';
  cellColors[1] = '#aa0000';

  const merged = mergePieces(
    [
      { index: 0, half: 'a' },
      { index: 1, half: null },
    ],
    cellColors,
    cellColorsB,
    cellDiagonals,
    4,
    4,
    {},
    createEmptyPieceMergeIds(16)
  );

  const result = applyTileFromSelection(
    cellColors,
    merged.merges,
    merged.cellMergeIds,
    4,
    4,
    [0, 1, 4, 5],
    { cellColorsB, cellDiagonals }
  );

  expect(result.error).toBeNull();
  expect(result.cellDiagonals[0]).toBe('nwse');
  expect(result.cellDiagonals[2]).toBe('nwse');
  expect(result.cellDiagonals[8]).toBe('nwse');
  expect(result.cellColorsB[0]).toBe('#00aa00');
  expect(result.cellColorsB[2]).toBe('#00aa00');
  // Triangle half A stays merged with the neighboring square in every tile.
  expect(result.pieceMergeIds[0].a).toBe(result.pieceMergeIds[1].a);
  expect(result.pieceMergeIds[0].b).toBeNull();
  expect(result.pieceMergeIds[2].a).toBe(result.pieceMergeIds[3].a);
  expect(result.pieceMergeIds[8].a).toBe(result.pieceMergeIds[9].a);
});

test('applyTileFromSelection returns pieceMergeIds for pasted merges', () => {
  const cellColors = Array(16).fill('#aabbcc');
  const mergeResult = mergeSelectedBlocks(cellColors, [0, 1], 4, {}, Array(16).fill(null));

  const result = applyTileFromSelection(
    cellColors,
    mergeResult.merges,
    mergeResult.cellMergeIds,
    4,
    4,
    [0, 1, 4, 5]
  );

  expect(result.error).toBeNull();
  expect(result.pieceMergeIds).toHaveLength(16);
  expect(result.pieceMergeIds[0].a).toBe(result.cellMergeIds[0]);
  expect(result.pieceMergeIds[0].b).toBe(result.cellMergeIds[0]);
});

test('piece selection helpers round-trip halves and cells', () => {
  const keys = getColoredPieceKeys(
    ['#ff0000', '#00ff00', null],
    ['#0000ff', null, null],
    ['nwse', null, null]
  );
  expect(keys).toEqual(['0:a', '0:b', '1:full']);

  expect(normalizeSelectedPieces([0, '2:a'], ['nwse', null, 'nesw'])).toEqual([
    '0:a',
    '0:b',
    '2:a',
  ]);

  expect(selectedPiecesToCellIndices(['0:a', '0:b', '3:full', 5])).toEqual([0, 3, 5]);
});
