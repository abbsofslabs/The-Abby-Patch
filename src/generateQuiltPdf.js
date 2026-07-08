import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  formatDimension,
  formatYards,
  SEAM_ALLOWANCE_PER_SIDE,
} from './yardageCalculator';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 52;
const BOTTOM_MARGIN = 52;
const MIN_FONT = 16;
const TITLE_FONT = 24;
const SECTION_FONT = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
const ROW_HEIGHT = 24;
const SWATCH_SIZE = 14;
const CUTTING_SWATCH_SIZE = 18;
const LOGO_SIZE = 52;
const CUTTING_FONT = 18;
const CUTTING_ROW_HEIGHT = 36;

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
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

function fitImageDimensions(canvas, maxWidth, maxHeight) {
  let width = maxWidth;
  let height = (canvas.height / canvas.width) * width;

  if (height > maxHeight) {
    height = maxHeight;
    width = (canvas.width / canvas.height) * height;
  }

  return { width, height };
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
    pdf.text(
      'The Abby Patch - Quilt Pattern',
      PAGE_WIDTH / 2,
      MARGIN + LOGO_SIZE / 2 + 6,
      { align: 'center' }
    );
    y = MARGIN + LOGO_SIZE + 28;
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
  const { r, g, b } = hexToRgb(color);
  const swatchY = y - swatchSize + 4;

  pdf.setFillColor(r, g, b);
  pdf.rect(x, swatchY, swatchSize, swatchSize, 'F');
  pdf.setDrawColor(61, 46, 38);
  pdf.rect(x, swatchY, swatchSize, swatchSize, 'S');

  const labelLines = pdf.splitTextToSize(label, maxLabelWidth);
  labelLines.forEach((line, lineIndex) => {
    pdf.text(line, x + swatchSize + 10, y + lineIndex * (MIN_FONT + 2));
  });
}

function formatCuttingInstruction(piece) {
  const unit = piece.cutWidth === piece.cutHeight ? 'squares' : 'rectangles';
  return `Cut ${piece.count} ${unit} at ${formatDimension(piece.cutWidth)} × ${formatDimension(piece.cutHeight)} inches`;
}

function drawCuttingGuide(ctx, colors, colorLabels, blockSize, sectionTitle, seamAllowance) {
  const rows = colors.filter((row) => (row.cutPieces?.length ? row.cutPieces : []).some((p) => p.count > 0));
  if (!rows.length || !blockSize) {
    return;
  }

  const { pdf } = ctx;
  const instructionX = MARGIN + 108;
  const instructionWidth = RIGHT_EDGE - instructionX;

  ctx.ensureSpace(SECTION_FONT + 80);
  ctx.addY(12);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text(sectionTitle, MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 14);

  pdf.setFontSize(MIN_FONT);
  pdf.setFont('helvetica', 'normal');
  writeWrappedText(
    ctx,
    `Grid cell: ${formatDimension(blockSize.width)} × ${formatDimension(blockSize.height)} in finished. ` +
      `Merged pieces use one seam allowance on outer edges only (${formatDimension(seamAllowance)} in per side). ` +
      `Yardage assumes 44 in usable width and allows rotating rectangles.`,
    MARGIN,
    CONTENT_WIDTH,
    MIN_FONT + 8
  );
  ctx.addY(6);

  rows.forEach((row) => {
    const cutPieces = row.cutPieces || [];
    const instructions = cutPieces
      .filter((piece) => piece.count > 0)
      .map((piece) => formatCuttingInstruction(piece));

    if (!instructions.length) {
      return;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(CUTTING_FONT);
    const instructionLines = instructions.flatMap((instruction) =>
      pdf.splitTextToSize(instruction, instructionWidth)
    );
    const rowHeight = Math.max(CUTTING_ROW_HEIGHT, instructionLines.length * (CUTTING_FONT + 8));

    ctx.ensureSpace(rowHeight);

    const label = colorLabels.get(row.color.toLowerCase()) ?? 'Color';
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(CUTTING_FONT);
    drawSwatchLabel(pdf, MARGIN, ctx.getY(), row.color, label, CUTTING_SWATCH_SIZE, 92);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(CUTTING_FONT);
    instructionLines.forEach((line, lineIndex) => {
      pdf.text(line, instructionX, ctx.getY() + lineIndex * (CUTTING_FONT + 6));
    });
    ctx.addY(rowHeight);
  });

  ctx.addY(8);
}

async function captureGrid(gridElement) {
  return html2canvas(gridElement, {
    scale: 2,
    backgroundColor: '#F5F2E9',
    logging: false,
  });
}

function drawSectionHeading(ctx, title) {
  const { pdf } = ctx;
  ctx.ensureSpace(SECTION_FONT + 16);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text(title, MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 12);
}

async function drawGridImage(ctx, gridElement, maxHeight) {
  const canvas = await captureGrid(gridElement);
  const { width, height } = fitImageDimensions(canvas, CONTENT_WIDTH, maxHeight);
  const remaining = PAGE_HEIGHT - BOTTOM_MARGIN - ctx.getY();

  if (height > remaining) {
    ctx.newPage();
  }

  ctx.ensureSpace(height + 12);
  const imgX = MARGIN + (CONTENT_WIDTH - width) / 2;
  ctx.pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, ctx.getY(), width, height);
  ctx.addY(height + 20);
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
  frontGridElement,
  backGridElement,
  frontReport,
  backReport,
  combinedReport,
}) {
  const hasAnyColors = combinedReport?.colors?.length > 0;
  if (!frontGridElement || !backGridElement || !hasAnyColors) {
    throw new Error('Grid and yardage data are required to generate a PDF.');
  }

  const logoData = await loadImageData(logoSrc);
  const ctx = createPdfWriter(logoData);
  const colorLabels = createColorLabelMap(combinedReport.colors);

  const maxGridHeight = 360;

  drawSectionHeading(ctx, 'Front');
  await drawGridImage(ctx, frontGridElement, maxGridHeight);
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
    'Front cutting guide',
    frontReport.seamAllowance ?? SEAM_ALLOWANCE_PER_SIDE
  );

  drawSectionHeading(ctx, 'Back');
  await drawGridImage(ctx, backGridElement, maxGridHeight);
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
    'Back cutting guide',
    backReport.seamAllowance ?? SEAM_ALLOWANCE_PER_SIDE
  );

  ctx.ensureSpace(SECTION_FONT + CUTTING_ROW_HEIGHT * 2);
  drawCombinedYardageTable(ctx, combinedReport, colorLabels);
  drawCuttingGuide(
    ctx,
    combinedReport.colors,
    colorLabels,
    combinedReport.blockSize,
    'Combined cutting guide'
  );

  ctx.pdf.save('abby-patch-quilt-pattern.pdf');
}
