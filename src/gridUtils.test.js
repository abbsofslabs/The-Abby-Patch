import {
  addBlockSelections,
  applyTileFromSelection,
  getColoredBlockIndices,
  removeBlockSelections,
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
