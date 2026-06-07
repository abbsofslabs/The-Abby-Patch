import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatYards } from './yardageCalculator';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const MIN_FONT = 16;
const TITLE_FONT = 24;
const SECTION_FONT = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 24;
const SWATCH_SIZE = 14;
const LOGO_SIZE = 52;

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
      if (y + height > PAGE_HEIGHT - MARGIN) {
        pdf.addPage();
        drawHeader();
      }
    },
  };
}

function drawSwatchLabel(pdf, x, y, color, label) {
  const { r, g, b } = hexToRgb(color);
  const swatchY = y - 12;

  pdf.setFillColor(r, g, b);
  pdf.rect(x, swatchY, SWATCH_SIZE, SWATCH_SIZE, 'F');
  pdf.setDrawColor(61, 46, 38);
  pdf.rect(x, swatchY, SWATCH_SIZE, SWATCH_SIZE, 'S');
  pdf.text(label, x + SWATCH_SIZE + 8, y);
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
  const remaining = PAGE_HEIGHT - MARGIN - ctx.getY();

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
    blocks: MARGIN + 180,
    yards: MARGIN + 280,
  };

  pdf.setFont('helvetica', 'bold');
  pdf.text('Color', columns.color, ctx.getY());
  pdf.text('Blocks', columns.blocks, ctx.getY());
  pdf.text('Yards', columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  pdf.setFont('helvetica', 'normal');
  report.colors.forEach((row) => {
    ctx.ensureSpace(ROW_HEIGHT);
    const label = colorLabels.get(row.color.toLowerCase()) ?? 'Color';
    drawSwatchLabel(pdf, columns.color, ctx.getY(), row.color, label);
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
  const tableHeight = ROW_HEIGHT * (combinedReport.colors.length + 4) + 20;
  ctx.ensureSpace(tableHeight + SECTION_FONT);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(SECTION_FONT);
  pdf.text('Combined total fabric', MARGIN, ctx.getY());
  ctx.addY(SECTION_FONT + 12);

  pdf.setFontSize(MIN_FONT);
  const columns = {
    color: MARGIN,
    front: MARGIN + 130,
    back: MARGIN + 190,
    total: MARGIN + 250,
    yards: MARGIN + 310,
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
    ctx.ensureSpace(ROW_HEIGHT);
    const label = colorLabels.get(row.color.toLowerCase()) ?? 'Color';
    drawSwatchLabel(pdf, columns.color, ctx.getY(), row.color, label);
    pdf.text(String(row.frontCount), columns.front, ctx.getY());
    pdf.text(String(row.backCount), columns.back, ctx.getY());
    pdf.text(String(row.totalCount), columns.total, ctx.getY());
    pdf.text(formatYards(row.yards), columns.yards, ctx.getY());
    ctx.addY(ROW_HEIGHT);
  });

  ctx.ensureSpace(ROW_HEIGHT * 3);
  pdf.text('Front only', columns.color, ctx.getY());
  pdf.text(formatYards(combinedReport.frontTotalYards), columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  pdf.text('Back only', columns.color, ctx.getY());
  pdf.text(formatYards(combinedReport.backTotalYards), columns.yards, ctx.getY());
  ctx.addY(ROW_HEIGHT);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Combined total fabric (front + back)', columns.color, ctx.getY());
  pdf.text(formatYards(combinedReport.totalYards), columns.yards, ctx.getY());
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

  drawSectionHeading(ctx, 'Back');
  await drawGridImage(ctx, backGridElement, maxGridHeight);
  drawSideYardageTable(
    ctx,
    backReport,
    colorLabels,
    'No fabric colors on the back side.'
  );

  drawCombinedYardageTable(ctx, combinedReport, colorLabels);

  ctx.pdf.save('abby-patch-quilt-pattern.pdf');
}
