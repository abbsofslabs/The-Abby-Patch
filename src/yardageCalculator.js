export const FABRIC_WIDTH = 44;
export const YARD_LENGTH = 36;
export const SQ_IN_PER_YARD = YARD_LENGTH * FABRIC_WIDTH;
export const SEAM_ALLOWANCE_FACTOR = 1.1;
export const MAX_GRID_SIZE = 36;

export function roundUpToQuarter(value) {
  return Math.ceil(value * 4) / 4;
}

export function formatDimension(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded}`;
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function calculateBlockSize(quiltWidth, quiltHeight, columns, rows) {
  const width = Number(quiltWidth);
  const height = Number(quiltHeight);

  if (!width || !height || !columns || !rows || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: width / columns,
    height: height / rows,
  };
}

export function calculateColorYardage(count, blockWidth, blockHeight) {
  if (!count || !blockWidth || !blockHeight) {
    return null;
  }

  const blocksPerRow = Math.max(1, Math.floor(FABRIC_WIDTH / blockWidth));
  const rowsNeeded = Math.ceil(count / blocksPerRow);
  const fabricLengthInches = rowsNeeded * blockHeight;
  const layoutSqIn = FABRIC_WIDTH * fabricLengthInches;
  const sqInWithSeam = layoutSqIn * SEAM_ALLOWANCE_FACTOR;

  const widthRemainder = FABRIC_WIDTH - blocksPerRow * blockWidth;
  const hasCuttingWaste = blockWidth <= FABRIC_WIDTH && widthRemainder > 0.001;

  let yards = roundUpToQuarter(sqInWithSeam / SQ_IN_PER_YARD);

  if (hasCuttingWaste) {
    const naiveSqIn = count * blockWidth * blockHeight * SEAM_ALLOWANCE_FACTOR;
    const naiveYards = roundUpToQuarter(naiveSqIn / SQ_IN_PER_YARD);
    yards = Math.max(yards, naiveYards);
    yards = roundUpToQuarter(yards);
  }

  return {
    count,
    blocksPerRow,
    rowsNeeded,
    sqInWithSeam,
    yards,
    hasCuttingWaste,
  };
}

export function countColorsByHex(cellColors) {
  const counts = {};
  cellColors.forEach((color) => {
    if (color) {
      const key = color.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  return counts;
}

export function buildYardageReport(cellColors, quiltWidth, quiltHeight, columns, rows) {
  const blockSize = calculateBlockSize(quiltWidth, quiltHeight, columns, rows);
  if (!blockSize) {
    return { blockSize: null, colors: [], totalYards: 0 };
  }

  const counts = countColorsByHex(cellColors);

  const colors = Object.entries(counts)
    .map(([color, count]) => {
      const yardage = calculateColorYardage(count, blockSize.width, blockSize.height);
      return { color, ...yardage };
    })
    .sort((a, b) => b.count - a.count);

  const totalYards = roundUpToQuarter(colors.reduce((sum, row) => sum + row.yards, 0));

  return { blockSize, colors, totalYards };
}

export function buildCombinedYardageReport(
  frontCellColors,
  backCellColors,
  quiltWidth,
  quiltHeight,
  columns,
  rows
) {
  const blockSize = calculateBlockSize(quiltWidth, quiltHeight, columns, rows);
  if (!blockSize) {
    return {
      blockSize: null,
      colors: [],
      totalYards: 0,
      frontTotalYards: 0,
      backTotalYards: 0,
    };
  }

  const frontCounts = countColorsByHex(frontCellColors);
  const backCounts = countColorsByHex(backCellColors);
  const allColorKeys = new Set([
    ...Object.keys(frontCounts),
    ...Object.keys(backCounts),
  ]);

  const colors = [...allColorKeys]
    .map((color) => {
      const frontCount = frontCounts[color] || 0;
      const backCount = backCounts[color] || 0;
      const totalCount = frontCount + backCount;
      const yardage = calculateColorYardage(totalCount, blockSize.width, blockSize.height);
      return {
        color,
        frontCount,
        backCount,
        totalCount,
        ...yardage,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  const frontReport = buildYardageReport(
    frontCellColors,
    quiltWidth,
    quiltHeight,
    columns,
    rows
  );
  const backReport = buildYardageReport(
    backCellColors,
    quiltWidth,
    quiltHeight,
    columns,
    rows
  );

  const totalYards = roundUpToQuarter(colors.reduce((sum, row) => sum + row.yards, 0));

  return {
    blockSize,
    colors,
    totalYards,
    frontTotalYards: frontReport.totalYards,
    backTotalYards: backReport.totalYards,
  };
}

export function formatYards(yards) {
  if (yards === 0) return '0 yd';
  const formatted = yards.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} yd`;
}
