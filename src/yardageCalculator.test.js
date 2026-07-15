import {
  buildYardageReport,
  calculatePiecesYardage,
  FABRIC_WIDTH,
  getCutBlockSize,
  getCutTriangleSize,
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
    expect(group.rowsNeeded * group.cutHeight).toBeLessThanOrEqual(
      yardage.sqInWithSeam / FABRIC_WIDTH + 0.001
    );
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
    expect(
      mergedReport.cutPieces.some((piece) => piece.count === 1 && piece.finishedWidth === 12)
    ).toBe(true);
  });

  test('HST cut size uses finished + 7/8 at quarter-inch seam allowance', () => {
    const cut = getCutTriangleSize(6, 0.25);
    expect(cut.width).toBeCloseTo(6.875, 5);
    expect(cut.height).toBeCloseTo(6.875, 5);
  });

  test('triangle pieces appear in cut list and pair onto shared cut squares', () => {
    const cellColors = ['#aa0000', null];
    const report = buildYardageReport(cellColors, {}, 12, 6, 2, 1, 0.25, {
      cellColorsB: ['#aa0000', null],
      cellDiagonals: ['nwse', null],
    });

    const hst = report.cutPieces.find((piece) => piece.shape === 'triangle');
    expect(hst).toBeTruthy();
    expect(hst.count).toBe(2);
    expect(hst.squaresNeeded).toBe(1);
    expect(hst.cutWidth).toBeCloseTo(6.875, 5);
    expect(hst.label).toContain('HST');
  });

  test('wider bolts need the same or less yardage', () => {
    // 40 squares cut at 6.5": 6 per strip on 44", 9 per strip on 60".
    const pieces = Array.from({ length: 40 }, () => ({
      color: '#556677',
      finishedWidth: 6,
      finishedHeight: 6,
    }));

    const narrow = calculatePiecesYardage(pieces, 0.25, 44);
    const wide = calculatePiecesYardage(pieces, 0.25, 60);

    // 44": ceil(40/6)=7 strips × 6.5" = 45.5" → 1.5 yd.
    expect(narrow.yards).toBe(1.5);
    // 60": ceil(40/9)=5 strips × 6.5" = 32.5" → 1 yd.
    expect(wide.yards).toBe(1);
  });

  test('yards come from bolt length, not square inches', () => {
    // One 20"-cut square on a 60" bolt still needs 20" of length (0.75 yd rounded).
    const result = calculatePiecesYardage(
      [{ color: '#889900', finishedWidth: 19.5, finishedHeight: 19.5 }],
      0.25,
      60
    );
    expect(result.yards).toBe(0.75);
  });

  test('flags pieces wider than the bolt in both directions', () => {
    const result = calculatePiecesYardage(
      [{ color: '#101010', finishedWidth: 70, finishedHeight: 70 }],
      0.25,
      44
    );
    expect(result.hasTooWidePieces).toBe(true);
    expect(result.cutPieces[0].tooWide).toBe(true);
  });

  test('buildYardageReport threads the fabric width through', () => {
    const cellColors = ['#334455'];
    const report = buildYardageReport(cellColors, {}, 6, 6, 1, 1, 0.25, {
      fabricWidth: 60,
    });
    expect(report.fabricWidth).toBe(60);
  });
});
