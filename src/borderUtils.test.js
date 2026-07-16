import {
  applyBorderMotifsToSide,
  createBorderStripState,
  getBorderCellIndices,
  resizeBorderStrip,
  restoreProtectedBorderCells,
} from './borderUtils';
import { mapResizedCellIndex, resizeSideState } from './gridResize';

describe('gridResize', () => {
  test('trims from the left and bottom when shrinking', () => {
    // 3×3 colored with unique markers; shrink to 2×2 keeps top-right block.
    const side = {
      cellColors: ['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'c0', 'c1', 'c2'],
      cellColorsB: Array(9).fill(null),
      cellFabricIds: Array(9).fill(null),
      cellFabricIdsB: Array(9).fill(null),
      cellDiagonals: Array(9).fill(null),
      merges: {},
      cellMergeIds: Array(9).fill(null),
      pieceMergeIds: Array.from({ length: 9 }, () => ({ a: null, b: null })),
    };

    const resized = resizeSideState(side, 3, 3, 2, 2);
    // Kept cols 1–2 of rows 0–1 → a1,a2 / b1,b2
    expect(resized.cellColors).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  test('adds empty columns on the left when growing wider', () => {
    expect(mapResizedCellIndex(0, 1, 2, 1, 3)).toBe(1); // old col0 → new col1
    expect(mapResizedCellIndex(1, 1, 2, 1, 3)).toBe(2);
  });
});

describe('borderUtils', () => {
  test('createBorderStripState builds a 1×N strip', () => {
    const strip = createBorderStripState(4);
    expect(strip.columns).toBe(4);
    expect(strip.cellColors).toHaveLength(4);
  });

  test('resizeBorderStrip keeps existing colors when widening', () => {
    const strip = createBorderStripState(2);
    strip.cellColors[0] = '#ff0000';
    const wider = resizeBorderStrip(strip, 4);
    expect(wider.cellColors[0]).toBe('#ff0000');
    expect(wider.cellColors).toHaveLength(4);
  });

  test('getBorderCellIndices returns the outer ring', () => {
    const cells = getBorderCellIndices(3, 3);
    expect([...cells].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });

  test('applyBorderMotifsToSide stamps top and bottom motifs and locks the border', () => {
    const side = {
      cellColors: Array(16).fill(null),
      cellColorsB: Array(16).fill(null),
      cellFabricIds: Array(16).fill(null),
      cellFabricIdsB: Array(16).fill(null),
      cellDiagonals: Array(16).fill(null),
      merges: {},
      cellMergeIds: Array(16).fill(null),
      pieceMergeIds: Array.from({ length: 16 }, () => ({ a: null, b: null })),
    };
    const top = createBorderStripState(4);
    top.cellColors = ['#111111', '#222222', '#333333', '#444444'];
    const bottom = createBorderStripState(3);
    bottom.cellColors = ['#aaaaaa', '#bbbbbb', '#cccccc'];

    const next = applyBorderMotifsToSide(side, 4, 4, top, bottom);
    expect(next.borderProtected).toBe(true);
    expect(next.cellColors[0]).toBe('#111111');
    expect(next.cellColors[1]).toBe('#222222');
    expect(next.cellColors[12]).toBe('#aaaaaa'); // bottom-left
    expect(next.cellColors[15]).toBe('#aaaaaa'); // 15 % 3 === 0 → first bottom color
  });

  test('restoreProtectedBorderCells keeps the outer ring after a paste', () => {
    const previous = {
      borderProtected: true,
      cellColors: Array(9).fill('#border'),
      cellColorsB: Array(9).fill(null),
      cellFabricIds: Array(9).fill(null),
      cellFabricIdsB: Array(9).fill(null),
      cellDiagonals: Array(9).fill(null),
    };
    previous.cellColors[4] = '#center';

    const tiled = {
      cellColors: Array(9).fill('#tiled'),
      cellColorsB: Array(9).fill(null),
      cellFabricIds: Array(9).fill(null),
      cellFabricIdsB: Array(9).fill(null),
      cellDiagonals: Array(9).fill(null),
      merges: {},
      cellMergeIds: Array(9).fill(null),
      pieceMergeIds: Array.from({ length: 9 }, () => ({ a: null, b: null })),
    };

    const restored = restoreProtectedBorderCells(previous, tiled, 3, 3);
    expect(restored.cellColors[0]).toBe('#border');
    expect(restored.cellColors[4]).toBe('#tiled');
    expect(restored.borderProtected).toBe(true);
  });
});
