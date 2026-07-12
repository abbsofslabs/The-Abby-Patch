import { forwardRef, memo, useMemo } from 'react';
import { CREAM } from '../constants';
import { getMergeBorders } from '../mergeUtils';

function cellBackground(color, colorB, diagonal) {
  const fillA = color || CREAM;
  if (!diagonal) {
    return { backgroundColor: fillA };
  }

  const fillB = colorB || CREAM;
  // nwse (\): half A is top-right; nesw (/): half A is top-left.
  const direction = diagonal === 'nwse' ? 'to bottom left' : 'to bottom right';
  return {
    background: `linear-gradient(${direction}, ${fillA} 0%, ${fillA} 50%, ${fillB} 50%, ${fillB} 100%)`,
  };
}

const PdfGrid = memo(
  forwardRef(function PdfGrid(
    { rows, columns, cellColors, cellColorsB, cellDiagonals, merges, cellMergeIds, pieceMergeIds },
    ref
  ) {
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
          const diagonal = cellDiagonals?.[index] ?? null;
          const mergeBorders = getMergeBorders(index, columns, merges, cellMergeIds, {
            rows,
            pieceMergeIds,
            cellDiagonals,
          });
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
            <div
              key={index}
              className={className}
              style={cellBackground(color, cellColorsB?.[index], diagonal)}
            />
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
  frontCellColorsB,
  frontCellDiagonals,
  frontMerges,
  frontCellMergeIds,
  frontPieceMergeIds,
  backCellColors,
  backCellColorsB,
  backCellDiagonals,
  backMerges,
  backCellMergeIds,
  backPieceMergeIds,
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
        cellColorsB={frontCellColorsB}
        cellDiagonals={frontCellDiagonals}
        merges={frontMerges}
        cellMergeIds={frontCellMergeIds}
        pieceMergeIds={frontPieceMergeIds}
      />
      <PdfGrid
        ref={backGridRef}
        rows={rows}
        columns={columns}
        cellColors={backCellColors}
        cellColorsB={backCellColorsB}
        cellDiagonals={backCellDiagonals}
        merges={backMerges}
        cellMergeIds={backCellMergeIds}
        pieceMergeIds={backPieceMergeIds}
      />
    </div>
  );
}

export default memo(PdfCaptureGrids);
