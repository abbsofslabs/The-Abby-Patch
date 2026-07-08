import { forwardRef, memo, useMemo } from 'react';
import { CREAM } from '../constants';
import { getMergeBorders } from '../mergeUtils';

const PdfGrid = memo(
  forwardRef(function PdfGrid({ rows, columns, cellColors, merges, cellMergeIds }, ref) {
    const gridStyle = useMemo(
      () => ({
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }),
      [rows, columns]
    );

    return (
      <div ref={ref} className="abby-patch__pdf-grid" style={gridStyle}>
        {cellColors.map((color, index) => {
          const mergeBorders = getMergeBorders(index, columns, merges, cellMergeIds);
          const className = [
            'abby-patch__pdf-cell',
            mergeBorders?.hideTop ? 'abby-patch__cell--merge-hide-top' : '',
            mergeBorders?.hideBottom ? 'abby-patch__cell--merge-hide-bottom' : '',
            mergeBorders?.hideLeft ? 'abby-patch__cell--merge-hide-left' : '',
            mergeBorders?.hideRight ? 'abby-patch__cell--merge-hide-right' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={index} className={className} style={{ backgroundColor: color || CREAM }} />
          );
        })}
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
  frontMerges,
  frontCellMergeIds,
  backCellColors,
  backMerges,
  backCellMergeIds,
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
        merges={frontMerges}
        cellMergeIds={frontCellMergeIds}
      />
      <PdfGrid
        ref={backGridRef}
        rows={rows}
        columns={columns}
        cellColors={backCellColors}
        merges={backMerges}
        cellMergeIds={backCellMergeIds}
      />
    </div>
  );
}

export default memo(PdfCaptureGrids);
