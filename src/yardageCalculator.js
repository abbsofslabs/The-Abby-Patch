import { extractCutPieces } from './mergeUtils';

export const FABRIC_WIDTH = 44;
export const YARD_LENGTH = 36;
export const SQ_IN_PER_YARD = YARD_LENGTH * FABRIC_WIDTH;
export const SEAM_ALLOWANCE_PER_SIDE = 0.25;
export const DEFAULT_SEAM_ALLOWANCE = SEAM_ALLOWANCE_PER_SIDE;
export const MAX_GRID_SIZE = 60;

export function getCutBlockSize(
  blockWidth,
  blockHeight,
  seamAllowance = DEFAULT_SEAM_ALLOWANCE
) {
  return {
    width: blockWidth + 2 * seamAllowance,
    height: blockHeight + 2 * seamAllowance,
  };
}

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

export function calculateGridDimensions(targetWidth, targetHeight, blockSize) {
  const width = Number(targetWidth);
  const height = Number(targetHeight);
  const block = Number(blockSize);

  if (!width || !height || !block || width <= 0 || height <= 0 || block <= 0) {
    return null;
  }

  let columns = Math.round(width / block);
  let rows = Math.round(height / block);
  columns = Math.max(1, Math.min(MAX_GRID_SIZE, columns));
  rows = Math.max(1, Math.min(MAX_GRID_SIZE, rows));

  return {
    rows,
    columns,
    blockSize: block,
    finishedWidth: columns * block,
    finishedHeight: rows * block,
  };
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

function normalizeCutKey(cutWidth, cutHeight) {
  const a = Math.min(cutWidth, cutHeight);
  const b = Math.max(cutWidth, cutHeight);
  return `${a}x${b}`;
}

function fabricLengthForCutPieces(cutWidth, cutHeight, count) {
  const orientations = [
    { pieceW: cutWidth, pieceH: cutHeight },
    { pieceW: cutHeight, pieceH: cutWidth },
  ];

  let bestLength = Infinity;
  let bestLayout = null;

  orientations.forEach((layout) => {
    if (layout.pieceW > FABRIC_WIDTH + 0.001) {
      return;
    }
    const piecesPerRow = Math.max(1, Math.floor(FABRIC_WIDTH / layout.pieceW));
    const rowsNeeded = Math.ceil(count / piecesPerRow);
    const fabricLength = rowsNeeded * layout.pieceH;
    if (fabricLength < bestLength) {
      bestLength = fabricLength;
      bestLayout = { ...layout, piecesPerRow, rowsNeeded };
    }
  });

  if (!bestLayout) {
    const naiveLength = (count * cutWidth * cutHeight) / FABRIC_WIDTH;
    return {
      fabricLength: naiveLength,
      piecesPerRow: 1,
      rowsNeeded: count,
      hasCuttingWaste: true,
    };
  }

  const widthRemainder = FABRIC_WIDTH - bestLayout.piecesPerRow * bestLayout.pieceW;
  return {
    fabricLength: bestLength,
    piecesPerRow: bestLayout.piecesPerRow,
    rowsNeeded: bestLayout.rowsNeeded,
    hasCuttingWaste: widthRemainder > 0.001,
  };
}

export function calculateColorYardage(count, finishedBlockWidth, finishedBlockHeight) {
  if (!count || !finishedBlockWidth || !finishedBlockHeight) {
    return null;
  }

  const { width: cutWidth, height: cutHeight } = getCutBlockSize(
    finishedBlockWidth,
    finishedBlockHeight
  );

  const layout = fabricLengthForCutPieces(cutWidth, cutHeight, count);
  const fabricSqIn = FABRIC_WIDTH * layout.fabricLength;
  let yards = roundUpToQuarter(fabricSqIn / SQ_IN_PER_YARD);

  if (layout.hasCuttingWaste) {
    const naiveSqIn = count * cutWidth * cutHeight;
    yards = Math.max(yards, roundUpToQuarter(naiveSqIn / SQ_IN_PER_YARD));
    yards = roundUpToQuarter(yards);
  }

  return {
    count,
    blocksPerRow: layout.piecesPerRow,
    rowsNeeded: layout.rowsNeeded,
    sqInWithSeam: fabricSqIn,
    yards,
    hasCuttingWaste: layout.hasCuttingWaste,
  };
}

export function calculatePiecesYardage(pieces, seamAllowance = DEFAULT_SEAM_ALLOWANCE) {
  if (!pieces.length) {
    return { yards: 0, sqInWithSeam: 0, cutPieces: [] };
  }

  const grouped = new Map();

  pieces.forEach((piece) => {
    const { width: cutW, height: cutH } = getCutBlockSize(
      piece.finishedWidth,
      piece.finishedHeight,
      seamAllowance
    );
    const key = `${piece.color}|${normalizeCutKey(cutW, cutH)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        color: piece.color,
        finishedWidth: piece.finishedWidth,
        finishedHeight: piece.finishedHeight,
        cutWidth: cutW,
        cutHeight: cutH,
        count: 1,
      });
    }
  });

  const cutPieces = [...grouped.values()].map((group) => ({
    ...group,
    label: `${formatDimension(group.finishedWidth)}×${formatDimension(group.finishedHeight)}″`,
  }));

  let totalSqIn = 0;
  let totalYards = 0;
  let hasCuttingWaste = false;

  cutPieces.forEach((group) => {
    const layout = fabricLengthForCutPieces(group.cutWidth, group.cutHeight, group.count);
    const fabricSqIn = FABRIC_WIDTH * layout.fabricLength;
    let yards = roundUpToQuarter(fabricSqIn / SQ_IN_PER_YARD);

    if (layout.hasCuttingWaste) {
      const naiveSqIn = group.count * group.cutWidth * group.cutHeight;
      yards = Math.max(yards, roundUpToQuarter(naiveSqIn / SQ_IN_PER_YARD));
      yards = roundUpToQuarter(yards);
      hasCuttingWaste = true;
    }

    group.yards = yards;
    group.sqInWithSeam = fabricSqIn;
    group.blocksPerRow = layout.piecesPerRow;
    group.rowsNeeded = layout.rowsNeeded;
    group.hasCuttingWaste = layout.hasCuttingWaste;
    totalSqIn += fabricSqIn;
    totalYards += yards;
  });

  return {
    yards: roundUpToQuarter(totalYards),
    sqInWithSeam: totalSqIn,
    cutPieces,
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

function buildSideYardageFromPieces(pieces, seamAllowance) {
  const byColor = new Map();
  pieces.forEach((piece) => {
    if (!byColor.has(piece.color)) {
      byColor.set(piece.color, []);
    }
    byColor.get(piece.color).push(piece);
  });

  const colors = [...byColor.entries()]
    .map(([color, colorPieces]) => {
      const yardage = calculatePiecesYardage(colorPieces, seamAllowance);
      return {
        color,
        count: colorPieces.length,
        ...yardage,
      };
    })
    .sort((a, b) => b.count - a.count);

  const totalYards = roundUpToQuarter(colors.reduce((sum, row) => sum + row.yards, 0));

  return { colors, totalYards };
}

export function buildYardageReport(
  cellColors,
  merges,
  quiltWidth,
  quiltHeight,
  columns,
  rows,
  seamAllowance = DEFAULT_SEAM_ALLOWANCE
) {
  const blockSize = calculateBlockSize(quiltWidth, quiltHeight, columns, rows);
  if (!blockSize) {
    return { blockSize: null, colors: [], totalYards: 0, cutPieces: [], seamAllowance };
  }

  const pieces = extractCutPieces(
    cellColors,
    merges || {},
    blockSize.width,
    blockSize.height
  );
  const { colors, totalYards } = buildSideYardageFromPieces(pieces, seamAllowance);
  const allCutPieces = colors.flatMap((row) => row.cutPieces || []);

  return { blockSize, colors, totalYards, cutPieces: allCutPieces, pieces, seamAllowance };
}

export function buildCombinedYardageReport(
  frontCellColors,
  frontMerges,
  backCellColors,
  backMerges,
  quiltWidth,
  quiltHeight,
  columns,
  rows,
  seamAllowance = DEFAULT_SEAM_ALLOWANCE
) {
  const blockSize = calculateBlockSize(quiltWidth, quiltHeight, columns, rows);
  if (!blockSize) {
    return {
      blockSize: null,
      colors: [],
      totalYards: 0,
      frontTotalYards: 0,
      backTotalYards: 0,
      cutPieces: [],
      seamAllowance,
    };
  }

  const frontReport = buildYardageReport(
    frontCellColors,
    frontMerges,
    quiltWidth,
    quiltHeight,
    columns,
    rows,
    seamAllowance
  );
  const backReport = buildYardageReport(
    backCellColors,
    backMerges,
    quiltWidth,
    quiltHeight,
    columns,
    rows,
    seamAllowance
  );

  const allPieces = [
    ...extractCutPieces(
      frontCellColors,
      frontMerges || {},
      blockSize.width,
      blockSize.height
    ),
    ...extractCutPieces(
      backCellColors,
      backMerges || {},
      blockSize.width,
      blockSize.height
    ),
  ];

  const byColor = new Map();
  allPieces.forEach((piece) => {
    if (!byColor.has(piece.color)) {
      byColor.set(piece.color, { color: piece.color, pieces: [], frontCount: 0, backCount: 0 });
    }
    const entry = byColor.get(piece.color);
    entry.pieces.push(piece);
  });

  frontReport.pieces?.forEach((piece) => {
    const entry = byColor.get(piece.color);
    if (entry) {
      entry.frontCount += 1;
    }
  });

  backReport.pieces?.forEach((piece) => {
    const entry = byColor.get(piece.color);
    if (entry) {
      entry.backCount += 1;
    }
  });

  const colors = [...byColor.values()]
    .map((entry) => {
      const yardage = calculatePiecesYardage(entry.pieces, seamAllowance);
      return {
        color: entry.color,
        frontCount: entry.frontCount,
        backCount: entry.backCount,
        totalCount: entry.pieces.length,
        ...yardage,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  const totalYards = roundUpToQuarter(colors.reduce((sum, row) => sum + row.yards, 0));

  return {
    blockSize,
    colors,
    totalYards,
    frontTotalYards: frontReport.totalYards,
    backTotalYards: backReport.totalYards,
    cutPieces: colors.flatMap((row) => row.cutPieces || []),
    seamAllowance,
  };
}

export function formatYards(yards) {
  if (yards === 0) return '0 yd';
  const formatted = yards.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} yd`;
}
