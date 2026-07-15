import { extractCutPieces } from './mergeUtils';

export const FABRIC_WIDTH = 44;
export const YARD_LENGTH = 36;
export const SQ_IN_PER_YARD = YARD_LENGTH * FABRIC_WIDTH;
export const SEAM_ALLOWANCE_PER_SIDE = 0.25;
export const DEFAULT_SEAM_ALLOWANCE = SEAM_ALLOWANCE_PER_SIDE;
export const MAX_GRID_SIZE = 60;

/** Common quilting bolt widths (inches). */
export const BOLT_WIDTH_OPTIONS = [
  { value: 42, label: '42″ (narrow quilting cotton)' },
  { value: 44, label: '44″ (standard quilting cotton)' },
  { value: 45, label: '45″ (standard quilting cotton)' },
  { value: 54, label: '54″ (decor weight)' },
  { value: 60, label: '60″ (wide bolt)' },
];
export const DEFAULT_BOLT_WIDTH = 44;

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

/**
 * Half-square triangle cut square.
 * Uses the classic finished + 7/8" rule at 1/4" SA, scaled with seam allowance.
 */
export function getCutTriangleSize(finishedLeg, seamAllowance = DEFAULT_SEAM_ALLOWANCE) {
  const diagonalFudge = seamAllowance * (0.875 / DEFAULT_SEAM_ALLOWANCE - 2);
  const cut = finishedLeg + 2 * seamAllowance + Math.max(0, diagonalFudge);
  return {
    width: cut,
    height: cut,
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

/**
 * Best strip layout for `count` identical cut pieces on a bolt of the given
 * usable width. Tries both piece orientations and keeps whichever uses the
 * least length of fabric (fewer strips breaks ties).
 */
function fabricLengthForCutPieces(cutWidth, cutHeight, count, fabricWidth = FABRIC_WIDTH) {
  const orientations = [
    { pieceW: cutWidth, pieceH: cutHeight },
    { pieceW: cutHeight, pieceH: cutWidth },
  ];

  let bestLength = Infinity;
  let bestLayout = null;

  orientations.forEach((layout) => {
    if (layout.pieceW > fabricWidth + 0.001) {
      return;
    }
    const piecesPerRow = Math.max(1, Math.floor((fabricWidth + 0.001) / layout.pieceW));
    const rowsNeeded = Math.ceil(count / piecesPerRow);
    const fabricLength = rowsNeeded * layout.pieceH;
    if (
      fabricLength < bestLength - 0.001 ||
      (Math.abs(fabricLength - bestLength) <= 0.001 &&
        bestLayout &&
        rowsNeeded < bestLayout.rowsNeeded)
    ) {
      bestLength = fabricLength;
      bestLayout = { ...layout, piecesPerRow, rowsNeeded };
    }
  });

  if (!bestLayout) {
    // The piece is wider than the bolt in both orientations. It cannot be cut
    // in one piece — flag it and reserve enough length to cut it lengthwise.
    const longSide = Math.max(cutWidth, cutHeight);
    return {
      fabricLength: count * longSide,
      piecesPerRow: 1,
      rowsNeeded: count,
      hasCuttingWaste: true,
      tooWide: true,
    };
  }

  const widthRemainder = fabricWidth - bestLayout.piecesPerRow * bestLayout.pieceW;
  return {
    fabricLength: bestLength,
    piecesPerRow: bestLayout.piecesPerRow,
    rowsNeeded: bestLayout.rowsNeeded,
    hasCuttingWaste: widthRemainder > 0.001,
    tooWide: false,
  };
}

export function calculateColorYardage(
  count,
  finishedBlockWidth,
  finishedBlockHeight,
  fabricWidth = FABRIC_WIDTH
) {
  if (!count || !finishedBlockWidth || !finishedBlockHeight) {
    return null;
  }

  const { width: cutWidth, height: cutHeight } = getCutBlockSize(
    finishedBlockWidth,
    finishedBlockHeight
  );

  const layout = fabricLengthForCutPieces(cutWidth, cutHeight, count, fabricWidth);
  const fabricSqIn = fabricWidth * layout.fabricLength;
  const yards = roundUpToQuarter(layout.fabricLength / YARD_LENGTH);

  return {
    count,
    blocksPerRow: layout.piecesPerRow,
    rowsNeeded: layout.rowsNeeded,
    sqInWithSeam: fabricSqIn,
    yards,
    hasCuttingWaste: layout.hasCuttingWaste,
    tooWide: layout.tooWide,
  };
}

export function calculatePiecesYardage(
  pieces,
  seamAllowance = DEFAULT_SEAM_ALLOWANCE,
  fabricWidth = FABRIC_WIDTH
) {
  if (!pieces.length) {
    return { yards: 0, sqInWithSeam: 0, cutPieces: [] };
  }

  const grouped = new Map();

  pieces.forEach((piece) => {
    const shape = piece.shape || 'rect';
    const cut =
      shape === 'triangle'
        ? getCutTriangleSize(piece.finishedWidth, seamAllowance)
        : getCutBlockSize(piece.finishedWidth, piece.finishedHeight, seamAllowance);
    const key = `${piece.color}|${shape}|${normalizeCutKey(cut.width, cut.height)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        color: piece.color,
        shape,
        finishedWidth: piece.finishedWidth,
        finishedHeight: piece.finishedHeight,
        cutWidth: cut.width,
        cutHeight: cut.height,
        count: 1,
      });
    }
  });

  const cutPieces = [...grouped.values()].map((group) => {
    const isTriangle = group.shape === 'triangle';
    const squaresNeeded = isTriangle ? Math.ceil(group.count / 2) : group.count;
    return {
      ...group,
      squaresNeeded,
      label: isTriangle
        ? `HST ${formatDimension(group.finishedWidth)}″`
        : `${formatDimension(group.finishedWidth)}×${formatDimension(group.finishedHeight)}″`,
    };
  });

  let totalSqIn = 0;
  let totalYards = 0;
  let hasCuttingWaste = false;
  let hasTooWidePieces = false;

  cutPieces.forEach((group) => {
    const layoutCount = group.squaresNeeded ?? group.count;
    const layout = fabricLengthForCutPieces(
      group.cutWidth,
      group.cutHeight,
      layoutCount,
      fabricWidth
    );
    const fabricSqIn = fabricWidth * layout.fabricLength;
    const yards = roundUpToQuarter(layout.fabricLength / YARD_LENGTH);

    if (layout.hasCuttingWaste) {
      hasCuttingWaste = true;
    }
    if (layout.tooWide) {
      hasTooWidePieces = true;
    }

    group.yards = yards;
    group.sqInWithSeam = fabricSqIn;
    group.blocksPerRow = layout.piecesPerRow;
    group.rowsNeeded = layout.rowsNeeded;
    group.hasCuttingWaste = layout.hasCuttingWaste;
    group.tooWide = layout.tooWide;
    totalSqIn += fabricSqIn;
    totalYards += yards;
  });

  return {
    yards: roundUpToQuarter(totalYards),
    sqInWithSeam: totalSqIn,
    cutPieces,
    hasCuttingWaste,
    hasTooWidePieces,
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

function buildSideYardageFromPieces(pieces, seamAllowance, fabricWidth) {
  const byColor = new Map();
  pieces.forEach((piece) => {
    if (!byColor.has(piece.color)) {
      byColor.set(piece.color, []);
    }
    byColor.get(piece.color).push(piece);
  });

  const colors = [...byColor.entries()]
    .map(([color, colorPieces]) => {
      const yardage = calculatePiecesYardage(colorPieces, seamAllowance, fabricWidth);
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
  seamAllowance = DEFAULT_SEAM_ALLOWANCE,
  options = {}
) {
  const fabricWidth = Number(options.fabricWidth) || DEFAULT_BOLT_WIDTH;
  const blockSize = calculateBlockSize(quiltWidth, quiltHeight, columns, rows);
  if (!blockSize) {
    return {
      blockSize: null,
      colors: [],
      totalYards: 0,
      cutPieces: [],
      seamAllowance,
      fabricWidth,
    };
  }

  const pieces = extractCutPieces(cellColors, merges || {}, blockSize.width, blockSize.height, {
    cellColorsB: options.cellColorsB,
    cellDiagonals: options.cellDiagonals,
  });
  const { colors, totalYards } = buildSideYardageFromPieces(pieces, seamAllowance, fabricWidth);
  const allCutPieces = colors.flatMap((row) => row.cutPieces || []);

  return {
    blockSize,
    colors,
    totalYards,
    cutPieces: allCutPieces,
    pieces,
    seamAllowance,
    fabricWidth,
    hasTooWidePieces: colors.some((row) => row.hasTooWidePieces),
  };
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
  seamAllowance = DEFAULT_SEAM_ALLOWANCE,
  options = {}
) {
  const fabricWidth = Number(options.fabricWidth) || DEFAULT_BOLT_WIDTH;
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
      fabricWidth,
    };
  }

  const frontOptions = {
    cellColorsB: options.frontCellColorsB,
    cellDiagonals: options.frontCellDiagonals,
    fabricWidth,
  };
  const backOptions = {
    cellColorsB: options.backCellColorsB,
    cellDiagonals: options.backCellDiagonals,
    fabricWidth,
  };

  const frontReport = buildYardageReport(
    frontCellColors,
    frontMerges,
    quiltWidth,
    quiltHeight,
    columns,
    rows,
    seamAllowance,
    frontOptions
  );
  const backReport = buildYardageReport(
    backCellColors,
    backMerges,
    quiltWidth,
    quiltHeight,
    columns,
    rows,
    seamAllowance,
    backOptions
  );

  const allPieces = [
    ...extractCutPieces(
      frontCellColors,
      frontMerges || {},
      blockSize.width,
      blockSize.height,
      frontOptions
    ),
    ...extractCutPieces(
      backCellColors,
      backMerges || {},
      blockSize.width,
      blockSize.height,
      backOptions
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
      const yardage = calculatePiecesYardage(entry.pieces, seamAllowance, fabricWidth);
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
    fabricWidth,
    hasTooWidePieces: colors.some((row) => row.hasTooWidePieces),
  };
}

export function formatYards(yards) {
  if (yards === 0) return '0 yd';
  const formatted = yards.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} yd`;
}
