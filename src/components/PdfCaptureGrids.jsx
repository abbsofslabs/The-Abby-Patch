import { forwardRef, memo, useMemo } from 'react';
import { CREAM } from '../constants';

const PdfGrid = memo(
  forwardRef(function PdfGrid({ rows, columns, cellColors }, ref) {
    const gridStyle = useMemo(
      () => ({
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }),
      [rows, columns]
    );

    return (
      <div ref={ref} className="abby-patch__pdf-grid" style={gridStyle}>
        {cellColors.map((color, index) => (
          <div
            key={index}
            className="abby-patch__pdf-cell"
            style={{ backgroundColor: color || CREAM }}
          />
        ))}
      </div>
    );
  })
);

function PdfCaptureGrids({
  frontGridRef,
  backGridRef,
  rows,
  columns,
  frontCellColors,
  backCellColors,
  isExporting,
}) {
  return (
    <div
      className={`abby-patch__pdf-capture ${isExporting ? 'abby-patch__pdf-capture--exporting' : ''}`}
      aria-hidden="true"
    >
      <PdfGrid
        ref={frontGridRef}
        rows={rows}
        columns={columns}
        cellColors={frontCellColors}
      />
      <PdfGrid
        ref={backGridRef}
        rows={rows}
        columns={columns}
        cellColors={backCellColors}
      />
    </div>
  );
}

export default memo(PdfCaptureGrids);
