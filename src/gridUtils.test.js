import { applyTileToSelection } from './gridUtils';

test('tiles a motif across a larger selection', () => {
  const columns = 4;
  const cellColors = Array(16).fill(null);
  const selectedBlocks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  cellColors[0] = '#ff0000';
  cellColors[1] = '#00ff00';
  cellColors[4] = '#00ff00';
  cellColors[5] = '#ff0000';

  const { cellColors: tiled, error } = applyTileToSelection(cellColors, columns, selectedBlocks);

  expect(error).toBeNull();
  expect(tiled[0]).toBe('#ff0000');
  expect(tiled[1]).toBe('#00ff00');
  expect(tiled[2]).toBe('#ff0000');
  expect(tiled[3]).toBe('#00ff00');
  expect(tiled[6]).toBe('#00ff00');
  expect(tiled[7]).toBe('#ff0000');
});

test('returns an error when the selection has no colored motif', () => {
  const { error } = applyTileToSelection(Array(16).fill(null), 4, [0, 1, 4, 5]);

  expect(error).toBe('no_motif');
});
