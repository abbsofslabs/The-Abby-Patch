import { extractCleanSeamLines, nearestNeighborDistance } from './seamLineCleanup';

test('drops spread-out outlier dots and keeps tight seam chains', () => {
  const segments = [
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 12, y: 10 },
    { x: 13, y: 10 },
    { x: 14, y: 10 },
    { x: 80, y: 80 },
  ];

  expect(nearestNeighborDistance(segments[5], segments)).toBeGreaterThan(6);

  const seamLines = extractCleanSeamLines({ segments, width: 100, height: 100 });
  expect(seamLines.length).toBeGreaterThanOrEqual(1);
  expect(seamLines[0].length).toBeGreaterThanOrEqual(4);
  expect(seamLines.flat().some((point) => point.x === 80 && point.y === 80)).toBe(false);
});

test('connects nearby dots into a continuous line', () => {
  const segments = [];
  for (let x = 20; x <= 40; x += 1) {
    segments.push({ x, y: 30 });
  }

  const seamLines = extractCleanSeamLines({ segments, width: 80, height: 80 });
  expect(seamLines.length).toBe(1);
  expect(seamLines[0].length).toBeGreaterThanOrEqual(10);
});
