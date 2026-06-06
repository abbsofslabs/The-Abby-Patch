import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatYards } from './yardageCalculator';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const MIN_FONT = 16;
const TITLE_FONT = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 24;
const SWATCH_SIZE = 14;

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

function fitImageDimensions(canvas, maxWidth, maxHeight) {
  let width = maxWidth;
  let height = (canvas.height / canvas.width) * width;

  if (height > maxHeight) {
    height = maxHeight;
    width = (canvas.width / canvas.height) * height;
  }

  return { width, height };
}

export async function generateQuiltPdf({ gridElement, yardageReport, sideLabel }) {
  if (!gridElement || !yardageReport?.colors?.length) {
    throw new Error('Grid and yardage data are required to generate a PDF.');
  }

  const canvas = await html2canvas(gridElement, {
    scale: 2,
    backgroundColor: '#F5F2E9',
    logging: false,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const tableRows = yardageReport.colors.length + 4;
  const tableHeight = ROW_HEIGHT * tableRows + 12;
  const headerHeight = TITLE_FONT + MIN_FONT + 36;
  const maxGridHeight = PAGE_HEIGHT - MARGIN * 2 - headerHeight - tableHeight;

  let y = MARGIN + TITLE_FONT;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(TITLE_FONT);
  pdf.text('The Abby Patch - Quilt Pattern', PAGE_WIDTH / 2, y, { align: 'center' });

  y += 28;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(MIN_FONT);
  pdf.text(`${sideLabel} side`, PAGE_WIDTH / 2, y, { align: 'center' });

  y += 24;
  const { width: imgWidth, height: imgHeight } = fitImageDimensions(
    canvas,
    CONTENT_WIDTH,
    maxGridHeight
  );
  const imgX = MARGIN + (CONTENT_WIDTH - imgWidth) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, y, imgWidth, imgHeight);

  y += imgHeight + 20;

  const columns = {
    color: MARGIN,
    front: MARGIN + 130,
    back: MARGIN + 190,
    total: MARGIN + 250,
    yards: MARGIN + 310,
  };

  pdf.setFontSize(MIN_FONT);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Color', columns.color, y);
  pdf.text('Front', columns.front, y);
  pdf.text('Back', columns.back, y);
  pdf.text('Total', columns.total, y);
  pdf.text('Yards', columns.yards, y);
  y += ROW_HEIGHT;

  pdf.setFont('helvetica', 'normal');
  yardageReport.colors.forEach((row, index) => {
    const { r, g, b } = hexToRgb(row.color);
    const swatchY = y - 12;

    pdf.setFillColor(r, g, b);
    pdf.rect(columns.color, swatchY, SWATCH_SIZE, SWATCH_SIZE, 'F');
    pdf.setDrawColor(61, 46, 38);
    pdf.rect(columns.color, swatchY, SWATCH_SIZE, SWATCH_SIZE, 'S');

    pdf.text(`Color ${index + 1}`, columns.color + SWATCH_SIZE + 8, y);
    pdf.text(String(row.frontCount), columns.front, y);
    pdf.text(String(row.backCount), columns.back, y);
    pdf.text(String(row.totalCount), columns.total, y);
    pdf.text(formatYards(row.yards), columns.yards, y);
    y += ROW_HEIGHT;
  });

  pdf.setFont('helvetica', 'normal');
  pdf.text('Front only', columns.color, y);
  pdf.text(formatYards(yardageReport.frontTotalYards), columns.yards, y);
  y += ROW_HEIGHT;

  pdf.text('Back only', columns.color, y);
  pdf.text(formatYards(yardageReport.backTotalYards), columns.yards, y);
  y += ROW_HEIGHT;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Combined total fabric', columns.color, y);
  pdf.text(formatYards(yardageReport.totalYards), columns.yards, y);

  pdf.save('abby-patch-quilt-pattern.pdf');
}
