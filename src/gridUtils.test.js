import { applyTileFromSelection } from './gridUtils';
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
