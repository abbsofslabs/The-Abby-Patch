import {
  applyBorderMotifsToSide,
  createBorderStripState,
  getBorderCellIndices,
  getBorderDepthFromStrips,
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
  test('createBorderStripState builds a 1×N depth strip', () => {
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

  test('getBorderCellIndices returns a thick frame', () => {
    const cells = getBorderCellIndices(4, 4, 1);
    expect([...cells].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15,
    ]);
    expect(getBorderCellIndices(4, 4, 2).size).toBe(16);
  });

  test('getBorderDepthFromStrips uses the thicker side', () => {
    expect(getBorderDepthFromStrips(createBorderStripState(4), createBorderStripState(3))).toBe(
      4
    );
  });

  test('applyBorderMotifsToSide stamps a depth frame, not a tiled edge motif', () => {
    const side = {
      cellColors: Array(36).fill(null),
      cellColorsB: Array(36).fill(null),
      cellFabricIds: Array(36).fill(null),
      cellFabricIdsB: Array(36).fill(null),
      cellDiagonals: Array(36).fill(null),
      merges: {},
      cellMergeIds: Array(36).fill(null),
      pieceMergeIds: Array.from({ length: 36 }, () => ({ a: null, b: null })),
    };
    // 6×6 quilt, 2-block-wide border: outer = #111, inner = #222
    const top = createBorderStripState(2);
    top.cellColors = ['#111111', '#222222'];

    const next = applyBorderMotifsToSide(side, 6, 6, top);
    expect(next.borderProtected).toBe(true);
    expect(next.borderDepth).toBe(2);

    // Outer ring all #111
    expect(next.cellColors[0]).toBe('#111111');
    expect(next.cellColors[5]).toBe('#111111');
    expect(next.cellColors[30]).toBe('#111111');
    // Second ring #222
    expect(next.cellColors[7]).toBe('#222222'); // row1 col1
    expect(next.cellColors[8]).toBe('#222222');
    // Center untouched
    expect(next.cellColors[14]).toBe(null); // row2 col2
    expect(next.cellColors[21]).toBe(null); // row3 col3

    // Different colors → separate single-layer strips (top outer vs top inner).
    const topOuterId = next.cellMergeIds[0];
    const topInnerId = next.cellMergeIds[6]; // row1 col0
    expect(topOuterId).not.toBeNull();
    expect(topInnerId).not.toBeNull();
    expect(topOuterId).not.toBe(topInnerId);
    expect(next.merges[topOuterId].height).toBe(1);
    expect(next.merges[topOuterId].width).toBe(6);
    expect(next.merges[topInnerId].height).toBe(1);
    expect(next.merges[topInnerId].width).toBe(6);
  });

  test('same-color border layers merge into one thicker strip', () => {
    const side = {
      cellColors: Array(36).fill(null),
      cellColorsB: Array(36).fill(null),
      cellFabricIds: Array(36).fill(null),
      cellFabricIdsB: Array(36).fill(null),
      cellDiagonals: Array(36).fill(null),
      merges: {},
      cellMergeIds: Array(36).fill(null),
      pieceMergeIds: Array.from({ length: 36 }, () => ({ a: null, b: null })),
    };
    const top = createBorderStripState(2);
    top.cellColors = ['#aa0000', '#aa0000'];

    const next = applyBorderMotifsToSide(side, 6, 6, top);
    const topId = next.cellMergeIds[0];
    expect(topId).not.toBeNull();
    expect(next.cellMergeIds[6]).toBe(topId); // row1 also in same merge
    expect(next.merges[topId].height).toBe(2);
    expect(next.merges[topId].width).toBe(6);
    expect(next.merges[topId].color.toLowerCase()).toBe('#aa0000');
  });

  test('applyBorderMotifsToSide supports different top and bottom depths', () => {
    const side = {
      cellColors: Array(36).fill(null),
      cellColorsB: Array(36).fill(null),
      cellFabricIds: Array(36).fill(null),
      cellFabricIdsB: Array(36).fill(null),
      cellDiagonals: Array(36).fill(null),
      merges: {},
      cellMergeIds: Array(36).fill(null),
      pieceMergeIds: Array.from({ length: 36 }, () => ({ a: null, b: null })),
    };
    const top = createBorderStripState(2);
    top.cellColors = ['#111111', '#222222'];
    const bottom = createBorderStripState(1);
    bottom.cellColors = ['#aaaaaa'];

    const next = applyBorderMotifsToSide(side, 6, 6, top, bottom);
    expect(next.borderDepth).toBe(2);
    expect(next.cellColors[0]).toBe('#111111');
    expect(next.cellColors[30]).toBe('#aaaaaa'); // bottom outer row
    expect(next.cellColors[24]).toBe('#111111'); // left side still uses top depth
  });

  test('restoreProtectedBorderCells keeps the thick frame after a paste', () => {
    const previous = {
      borderProtected: true,
      borderDepth: 1,
      borderTopDepth: 1,
      borderBottomDepth: 1,
      cellColors: Array(9).fill('#border'),
      cellColorsB: Array(9).fill(null),
      cellFabricIds: Array(9).fill(null),
      cellFabricIdsB: Array(9).fill(null),
      cellDiagonals: Array(9).fill(null),
      merges: {},
      cellMergeIds: Array(9).fill(null),
      pieceMergeIds: Array.from({ length: 9 }, () => ({ a: null, b: null })),
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
    expect(restored.borderDepth).toBe(1);
    // Outer ring same color → re-merged into strips after paste restore.
    expect(restored.cellMergeIds[0]).not.toBeNull();
  });
});
