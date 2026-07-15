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
import { mergeSelectedBlocks } from './mergeUtils';

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

test('pattern snapshot skips triangle-half merges and keeps full-cell merges', () => {
  const cellColors = Array(16).fill('#123456');

  const fullMerge = mergeSelectedBlocks(cellColors, [4, 5], 4, {}, Array(16).fill(null));

  // Hand-built legacy half merge — the UI can no longer create these, but old
  // saved sessions may still contain them.
  const merges = {
    ...fullMerge.merges,
    99: {
      id: 99,
      color: '#123456',
      minRow: 0,
      minCol: 0,
      width: 2,
      height: 1,
      cells: [0, 1],
      pieces: [
        { index: 0, half: 'a' },
        { index: 1, half: null },
      ],
    },
  };

  const snapshot = extractPatternSnapshot(
    cellColors,
    merges,
    fullMerge.cellMergeIds,
    4,
    [0, 1, 4, 5]
  );

  expect(snapshot.error).toBeNull();
  const copied = Object.values(snapshot.merges);
  expect(copied).toHaveLength(1);
  expect(copied[0].cells).toEqual([2, 3]);
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
