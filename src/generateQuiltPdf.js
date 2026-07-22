import { jsPDF } from 'jspdf';
import { CREAM } from './constants';
import { getMergeBorders } from './mergeUtils';
import {
  formatCuttingInches,
  formatYards,
  SEAM_ALLOWANCE_PER_SIDE,
} from './yardageCalculator';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const BOTTOM_MARGIN = 48;
const MIN_FONT = 14;
const TITLE_FONT = 22;
const SECTION_FONT = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
const ROW_HEIGHT = 22;
const SWATCH_SIZE = 14;
const CUTTING_SWATCH_SIZE = 18;
const LOGO_SIZE = 48;
const CUTTING_FONT = 15;
const CUTTING_LINE = 20;

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const num = parseInt(value, 16);
  if (!Number.isFinite(num)) {
    return { r: 245, g: 242, b: 233 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function fillColor(pdf, hex) {
  const { r, g, b } = hexToRgb(hex);
  pdf.setFillColor(r, g, b);
}

function loadImageData(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

function createColorLabelMap(combinedColors) {
  const labels = new Map();
  combinedColors.forEach((row, index) => {
    labels.set(row.color.toLowerCase(), `Color ${index + 1}`);
  });
  return labels;
}

function createPdfWriter(logoData) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  let y = MARGIN;

  const drawHeader = () => {
    pdf.addImage(logoData, 'PNG', MARGIN, MARGIN, LOGO_SIZE, LOGO_SIZE);
    pdf.addImage(
      logoData,
      'PNG',
      PAGE_WIDTH - MARGIN - LOGO_SIZE,
      MARGIN,
      LOGO_SIZE,
      LOGO_SIZE
    );
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(TITLE_FONT);
    pdf.setTextColor(61, 46, 38);
    pdf.text(
      'The Abby Patch — Quilt Pattern',
      PAGE_WIDTH / 2,
      MARGIN + LOGO_SIZE / 2 + 5,
      { align: 'center' }
    );
    y = MARGIN + LOGO_SIZE + 24;
  };

  drawHeader();

  return {
    pdf,
    getY: () => y,
    setY: (value) => {
      y = value;
    },
    addY: (delta) => {
      y += delta;
    },
    newPage: () => {
      pdf.addPage();
      drawHeader();
    },
    ensureSpace: (height) => {
      if (y + height > PAGE_HEIGHT - BOTTOM_MARGIN) {
        pdf.addPage();
        drawHeader();
      }
    },
  };
}

function writeWrappedText(ctx, text, x, maxWidth, lineHeight = MIN_FONT + 6) {
  const { pdf } = ctx;
  const lines = pdf.splitTextToSize(text, maxWidth);

  lines.forEach((line) => {
    ctx.ensureSpace(lineHeight);
    pdf.text(line, x, ctx.getY());
    ctx.addY(lineHeight);
  });

  return lines.length * lineHeight;
}

function drawSwatchLabel(pdf, x, y, color, label, swatchSize = SWATCH_SIZE, maxLabelWidth = 110) {
  const swatchY = y - swatchSize + 4;
  fillColor(pdf, color);
  pdf.rect(x, swatchY, swatchSize, swatchSize, 'F');
  pdf.setDrawColor(61, 46, 38);
  pdf.setLineWidth(0.8);
  pdf.rect(x, swatchY, swatchSize, swatchSize, 'S');

  const labelLines = pdf.splitTextToSize(label, maxLabelWidth);
  labelLines.forEach((line, lineIndex) => {
    pdf.text(line, x + swatchSize + 10, y + lineIndex * (MIN_FONT + 2));
  });
}

function reportHasTriangles(colors = []) {
  return colors.some((row) =>
    (row.cutPieces || []).some((piece) => piece.shape === 'triangle' && piece.count > 0)
  );
}

/** Plain-English cut steps. Triangles get numbered how-to steps. */
function formatCuttingInstructions(piece) {
  if (piece.shape === 'triangle') {
    const squares = piece.squaresNeeded ?? Math.ceil(piece.count / 2);
    const size = formatCuttingInches(piece.cutWidth);
    const fromSquares = squares * 2;
    const lines = [
      `Step 1: Cut ${squares} square${squares === 1 ? '' : 's'}. Make each square ${size} inches on every side.`,
      'Step 2: Take one square. Cut from one corner straight to the opposite corner (corner to corner).',
      'Step 3: Do the same on every square. Each square makes 2 triangles.',
    ];
    if (fromSquares === piece.count) {
      lines.push(`You will have ${piece.count} triangle${piece.count === 1 ? '' : 's'}.`);
    } else {
      lines.push(
        `This gives you ${fromSquares} triangles. You need ${piece.count} for this quilt — set the extras aside.`
      );
    }
    return lines;
  }

  const w = formatCuttingInches(piece.cutWidth);
  const h = formatCuttingInches(piece.cutHeight);
  const isSquare = Math.abs(piece.cutWidth - piece.cutHeight) < 0.001;
  if (isSquare) {
    return [
      `Cut ${piece.count} square${piece.count === 1 ? '' : 's'}. Make each one ${w} inches by ${h} inches.`,
    ];
  }
  const tooWide = piece.tooWide
    ? ' This piece is wider than your fabric bolt — sew smaller pieces together to make it.'
    : '';
  return [
    `Cut ${piece.count} rectangle${piece.count === 1 ? '' : 's'}. Make each one ${w} inches by ${h} inches.${tooWide}`,
  ];
}

function drawTriangleHowTo(ctx) {
  const { pdf } = ctx;
  ctx.ensureSpace(150);
  ctx.addY(8);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text('How to cut the triangles', MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(MIN_FONT);
  writeWrappedText(
    ctx,
    'Whenever this pattern asks for triangles, cut them like this:',
    MARGIN,
    CONTENT_WIDTH,
    MIN_FONT + 6
  );
  writeWrappedText(
    ctx,
    '1. Cut a square the exact size listed for that color.',
    MARGIN,
    CONTENT_WIDTH,
    MIN_FONT + 6
  );
  writeWrappedText(
    ctx,
    '2. Cut that square in half from one corner to the opposite corner.',
    MARGIN,
    CONTENT_WIDTH,
    MIN_FONT + 6
  );
  writeWrappedText(
    ctx,
    '3. One square makes two matching triangles.',
    MARGIN,
    CONTENT_WIDTH,
    MIN_FONT + 6
  );
  ctx.addY(6);

  // Simple diagram: square with diagonal → two triangles
  const box = 52;
  const gap = 28;
  const startX = MARGIN + 20;
  const startY = ctx.getY();
  ctx.ensureSpace(box + 36);

  pdf.setDrawColor(61, 46, 38);
  pdf.setLineWidth(1.2);
  pdf.setFillColor(232, 226, 214);
  pdf.rect(startX, startY, box, box, 'FD');
  pdf.line(startX, startY, startX + box, startY + box);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text('Square', startX + box / 2, startY + box + 14, { align: 'center' });
  pdf.text('Cut corner to corner', startX + box / 2, startY + box + 26, {
    align: 'center',
  });

  const arrowX = startX + box + gap / 2;
  pdf.setFontSize(16);
  pdf.text('→', arrowX, startY + box / 2 + 4, { align: 'center' });

  const tX = startX + box + gap;
  pdf.setFillColor(232, 226, 214);
  pdf.triangle(tX, startY, tX + box, startY, tX + box, startY + box, 'FD');
  pdf.triangle(tX + box + 10, startY, tX + box + 10, startY + box, tX + 10 + box * 2, startY + box, 'FD');

  pdf.setFontSize(11);
  pdf.text('2 triangles', tX + box + 5, startY + box + 14, { align: 'center' });

  ctx.addY(box + 40);
}

function drawCuttingGuide(ctx, colors, colorLabels, blockSize, sectionTitle, seamAllowance, fabricWidth = 44) {
  const rows = colors.filter((row) =>
    (row.cutPieces?.length ? row.cutPieces : []).some((p) => p.count > 0)
  );
  if (!rows.length || !blockSize) {
    return;
  }

  const { pdf } = ctx;
  const instructionX = MARGIN + 100;
  const instructionWidth = RIGHT_EDGE - instructionX;

  ctx.ensureSpace(SECTION_FONT + 60);
  ctx.addY(10);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text(sectionTitle, MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 10);

  pdf.setFontSize(MIN_FONT);
  pdf.setFont('helvetica', 'normal');
  writeWrappedText(
    ctx,
    `Each finished block on the quilt is ${formatCuttingInches(blockSize.width)} inches by ${formatCuttingInches(blockSize.height)} inches. ` +
      `The cut sizes below already include a ${formatCuttingInches(seamAllowance)}-inch seam allowance. ` +
      `Your fabric bolt is ${formatCuttingInches(fabricWidth)} inches wide.`,
    MARGIN,
    CONTENT_WIDTH,
    MIN_FONT + 6
  );
  ctx.addY(8);

  rows.forEach((row) => {
    const cutPieces = (row.cutPieces || []).filter((piece) => piece.count > 0);
    if (!cutPieces.length) {
      return;
    }

    cutPieces.forEach((piece, pieceIndex) => {
      const instructions = formatCuttingInstructions(piece);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(CUTTING_FONT);
      const instructionLines = instructions.flatMap((instruction) =>
        pdf.splitTextToSize(instruction, instructionWidth)
      );
      const rowHeight = Math.max(CUTTING_SWATCH_SIZE + 8, instructionLines.length * CUTTING_LINE + 8);

      ctx.ensureSpace(rowHeight + 4);

      if (pieceIndex === 0) {
        const label = colorLabels.get(row.color.toLowerCase()) ?? 'Color';
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(CUTTING_FONT);
        drawSwatchLabel(pdf, MARGIN, ctx.getY(), row.color, label, CUTTING_SWATCH_SIZE, 84);
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(CUTTING_FONT);
      instructionLines.forEach((line, lineIndex) => {
        pdf.text(line, instructionX, ctx.getY() + lineIndex * CUTTING_LINE);
      });
      ctx.addY(rowHeight);
    });
  });

  ctx.addY(6);
}

function drawCellEdges(pdf, x, y, w, h, hideTop, hideRight, hideBottom, hideLeft) {
  pdf.setDrawColor(168, 152, 136);
  pdf.setLineWidth(0.45);
  if (!hideTop) pdf.line(x, y, x + w, y);
  if (!hideRight) pdf.line(x + w, y, x + w, y + h);
  if (!hideBottom) pdf.line(x, y + h, x + w, y + h);
  if (!hideLeft) pdf.line(x, y, x, y + h);
}

/** Draw the quilt grid directly in the PDF (no HTML screenshot). */
function drawQuiltGrid(ctx, side, rows, columns, maxHeight) {
  const { pdf } = ctx;
  const aspect = columns / Math.max(rows, 1);
  let gridW = CONTENT_WIDTH;
  let gridH = gridW / aspect;
  if (gridH > maxHeight) {
    gridH = maxHeight;
    gridW = gridH * aspect;
  }

  ctx.ensureSpace(gridH + 16);
  const x0 = MARGIN + (CONTENT_WIDTH - gridW) / 2;
  const y0 = ctx.getY();
  const cellW = gridW / columns;
  const cellH = gridH / rows;

  const cellColors = side.cellColors || [];
  const cellColorsB = side.cellColorsB || [];
  const cellDiagonals = side.cellDiagonals || [];
  const merges = side.merges || {};
  const cellMergeIds = side.cellMergeIds || [];
  const pieceMergeIds = side.pieceMergeIds || [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col;
      const x = x0 + col * cellW;
      const y = y0 + row * cellH;
      const diagonal = cellDiagonals[index] ?? null;
      const borders = getMergeBorders(index, columns, merges, cellMergeIds, {
        rows,
        pieceMergeIds,
        cellDiagonals,
      });
      const hideTop = Boolean(borders?.hideTop);
      const hideBottom = Boolean(borders?.hideBottom);
      const hideLeft = Boolean(borders?.hideLeft);
      const hideRight = Boolean(borders?.hideRight);
      const showDiagonal =
        borders?.showDiagonal ?? (Boolean(diagonal) && !borders?.hideDiagonal);

      const fillA = cellColors[index] || CREAM;
      const fillB = diagonal ? cellColorsB[index] || CREAM : fillA;

      if (showDiagonal && diagonal === 'nwse') {
        // Top-right triangle (A), bottom-left triangle (B)
        fillColor(pdf, fillA);
        pdf.triangle(x, y, x + cellW, y, x + cellW, y + cellH, 'F');
        fillColor(pdf, fillB);
        pdf.triangle(x, y, x, y + cellH, x + cellW, y + cellH, 'F');
        pdf.setDrawColor(100, 88, 76);
        pdf.setLineWidth(0.9);
        pdf.line(x, y, x + cellW, y + cellH);
      } else if (showDiagonal && diagonal === 'nesw') {
        // Top-left triangle (A), bottom-right triangle (B)
        fillColor(pdf, fillA);
        pdf.triangle(x, y, x + cellW, y, x, y + cellH, 'F');
        fillColor(pdf, fillB);
        pdf.triangle(x + cellW, y, x + cellW, y + cellH, x, y + cellH, 'F');
        pdf.setDrawColor(100, 88, 76);
        pdf.setLineWidth(0.9);
        pdf.line(x + cellW, y, x, y + cellH);
      } else {
        fillColor(pdf, fillA);
        pdf.rect(x, y, cellW, cellH, 'F');
      }

      drawCellEdges(pdf, x, y, cellW, cellH, hideTop, hideRight, hideBottom, hideLeft);
    }
  }

  pdf.setDrawColor(61, 46, 38);
  pdf.setLineWidth(1.6);
  pdf.rect(x0, y0, gridW, gridH, 'S');

  ctx.addY(gridH + 18);
}

function drawSectionHeading(ctx, title) {
  const { pdf } = ctx;
  ctx.ensureSpace(SECTION_FONT + 16);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text(title, MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 10);
}

function estimateSideTableHeight(report) {
  if (!report?.colors?.length) {
    return ROW_HEIGHT + 8;
  }
  return ROW_HEIGHT * (report.colors.length + 2) + 12;
}

function drawSideYardageTable(ctx, report, colorLabels, emptyMessage) {
  const { pdf } = ctx;
  const tableHeight = estimateSideTableHeight(report);
  ctx.ensureSpace(tableHeight);

  pdf.setFontSize(MIN_FONT);

  if (!report?.colors?.length) {
    pdf.setFont('helvetica', 'italic');
    pdf.text(emptyMessage, MARGIN, ctx.getY());
    ctx.addY(ROW_HEIGHT + 8);
    return;
  }

  const columns = {
    color: MARGIN,
    blocks: MARGIN + 200,
    yards: MARGIN + 300,
  };

  pdf.setFont('helvetica', 'bold');
  pdf.text('Color', columns.color, ctx.getY());
  pdf.text('Pieces', columns.blocks, ctx.getY());
  pdf.text('Yards', columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  pdf.setFont('helvetica', 'normal');
  report.colors.forEach((row) => {
    ctx.ensureSpace(ROW_HEIGHT + 4);
    const label = colorLabels.get(row.color.toLowerCase()) ?? 'Color';
    drawSwatchLabel(pdf, columns.color, ctx.getY(), row.color, label, SWATCH_SIZE, 170);
    pdf.text(String(row.count), columns.blocks, ctx.getY());
    pdf.text(formatYards(row.yards), columns.yards, ctx.getY());
    ctx.addY(ROW_HEIGHT);
  });

  ctx.ensureSpace(ROW_HEIGHT);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Side total fabric', columns.color, ctx.getY());
  pdf.text(formatYards(report.totalYards), columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT + 16);
}

function drawCombinedYardageTable(ctx, combinedReport, colorLabels) {
  const { pdf } = ctx;

  ctx.ensureSpace(SECTION_FONT + ROW_HEIGHT * 2);
  ctx.addY(8);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text('Combined total fabric', MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 12);

  pdf.setFontSize(MIN_FONT);
  const columns = {
    color: MARGIN,
    front: MARGIN + 168,
    back: MARGIN + 228,
    total: MARGIN + 288,
    yards: MARGIN + 348,
  };

  pdf.setFont('helvetica', 'bold');
  pdf.text('Color', columns.color, ctx.getY());
  pdf.text('Front', columns.front, ctx.getY());
  pdf.text('Back', columns.back, ctx.getY());
  pdf.text('Total', columns.total, ctx.getY());
  pdf.text('Yards', columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  pdf.setFont('helvetica', 'normal');
  combinedReport.colors.forEach((row) => {
    ctx.ensureSpace(ROW_HEIGHT + 4);
    const label = colorLabels.get(row.color.toLowerCase()) ?? 'Color';
    drawSwatchLabel(pdf, columns.color, ctx.getY(), row.color, label, SWATCH_SIZE, 140);
    pdf.text(String(row.frontCount), columns.front, ctx.getY());
    pdf.text(String(row.backCount), columns.back, ctx.getY());
    pdf.text(String(row.totalCount), columns.total, ctx.getY());
    pdf.text(formatYards(row.yards), columns.yards, ctx.getY());
    ctx.addY(ROW_HEIGHT);
  });

  ctx.ensureSpace(ROW_HEIGHT);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Front only', columns.color, ctx.getY());
  pdf.text(formatYards(combinedReport.frontTotalYards), columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  ctx.ensureSpace(ROW_HEIGHT);
  pdf.text('Back only', columns.color, ctx.getY());
  pdf.text(formatYards(combinedReport.backTotalYards), columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  ctx.ensureSpace(ROW_HEIGHT + 8);
  pdf.text('Combined total', columns.color, ctx.getY());
  pdf.text(formatYards(combinedReport.totalYards), columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT + 20);
}

export async function generateQuiltPdf({
  logoSrc,
  grid,
  frontSide,
  backSide,
  frontReport,
  backReport,
  combinedReport,
}) {
  const hasAnyColors = combinedReport?.colors?.length > 0;
  if (!grid || !frontSide || !backSide || !hasAnyColors) {
    throw new Error('Grid and yardage data are required to generate a PDF.');
  }

  const logoData = await loadImageData(logoSrc);
  const ctx = createPdfWriter(logoData);
  const colorLabels = createColorLabelMap(combinedReport.colors);
  const maxGridHeight = 340;
  const showTriangleHowTo =
    reportHasTriangles(frontReport?.colors) ||
    reportHasTriangles(backReport?.colors) ||
    reportHasTriangles(combinedReport?.colors);

  if (showTriangleHowTo) {
    drawTriangleHowTo(ctx);
  }

  drawSectionHeading(ctx, 'Front of quilt');
  drawQuiltGrid(ctx, frontSide, grid.rows, grid.columns, maxGridHeight);
  drawSideYardageTable(
    ctx,
    frontReport,
    colorLabels,
    'No fabric colors on the front side.'
  );
  drawCuttingGuide(
    ctx,
    frontReport.colors,
    colorLabels,
    frontReport.blockSize,
    'Front — what to cut',
    frontReport.seamAllowance ?? SEAM_ALLOWANCE_PER_SIDE,
    frontReport.fabricWidth
  );

  drawSectionHeading(ctx, 'Back of quilt');
  drawQuiltGrid(ctx, backSide, grid.rows, grid.columns, maxGridHeight);
  drawSideYardageTable(
    ctx,
    backReport,
    colorLabels,
    'No fabric colors on the back side.'
  );
  drawCuttingGuide(
    ctx,
    backReport.colors,
    colorLabels,
    backReport.blockSize,
    'Back — what to cut',
    backReport.seamAllowance ?? SEAM_ALLOWANCE_PER_SIDE,
    backReport.fabricWidth
  );

  drawCombinedYardageTable(ctx, combinedReport, colorLabels);
  drawCuttingGuide(
    ctx,
    combinedReport.colors,
    colorLabels,
    combinedReport.blockSize,
    'Both sides together — what to cut',
    combinedReport.seamAllowance ?? SEAM_ALLOWANCE_PER_SIDE,
    combinedReport.fabricWidth
  );

  ctx.pdf.save('abby-patch-quilt-pattern.pdf');
}
