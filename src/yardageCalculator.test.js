import {
  buildYardageReport,
  calculatePiecesYardage,
  FABRIC_WIDTH,
  getCutBlockSize,
} from './yardageCalculator';
import { mergeSelectedBlocks } from './mergeUtils';

describe('yardageCalculator merge support', () => {
  test('treats vertical and horizontal rectangles the same for yardage', () => {
    const tall = calculatePiecesYardage([
      { color: '#111111', finishedWidth: 6, finishedHeight: 12 },
    ]);
    const wide = calculatePiecesYardage([
      { color: '#111111', finishedWidth: 12, finishedHeight: 6 },
    ]);

    expect(tall.yards).toBe(wide.yards);
    expect(tall.sqInWithSeam).toBe(wide.sqInWithSeam);
  });

  test('yardage layout respects fabric width for cut pieces', () => {
    const { width: cutW, height: cutH } = getCutBlockSize(12, 6);
    const yardage = calculatePiecesYardage([
      { color: '#222222', finishedWidth: 12, finishedHeight: 6 },
      { color: '#222222', finishedWidth: 12, finishedHeight: 6 },
    ]);

    const group = yardage.cutPieces[0];
    expect(group.cutWidth).toBe(cutW);
    expect(group.cutHeight).toBe(cutH);
    expect(group.blocksPerRow * group.cutWidth).toBeLessThanOrEqual(FABRIC_WIDTH + 0.001);
    expect(group.rowsNeeded * group.cutHeight).toBeLessThanOrEqual(yardage.sqInWithSeam / FABRIC_WIDTH + 0.001);
  });

  test('buildYardageReport counts fewer pieces when blocks are merged', () => {
    const cellColors = Array(4).fill('#334455');
    const mergeResult = mergeSelectedBlocks(cellColors, [0, 1], 2, {}, Array(4).fill(null));

    const unmergedReport = buildYardageReport(cellColors, {}, 12, 12, 2, 2);
    const mergedReport = buildYardageReport(
      cellColors,
      mergeResult.merges,
      12,
      12,
      2,
      2
    );

    expect(unmergedReport.colors[0].count).toBe(4);
    expect(mergedReport.colors[0].count).toBe(3);
    expect(mergedReport.cutPieces.some((piece) => piece.count === 1 && piece.finishedWidth === 12)).toBe(
      true
    );
  });
});
