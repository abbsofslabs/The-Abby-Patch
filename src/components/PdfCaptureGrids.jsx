import { forwardRef, memo, useMemo } from 'react';
import { CREAM } from '../constants';
import { getMergeBorders } from '../mergeUtils';

/** Bleed past a merge-hidden edge so fills underlap the neighbor. */
const BLEED = 1.5;

function nwsePolygons(fillA, fillB, hideTop, hideRight, hideBottom, hideLeft, showCut) {
  const aT = hideTop ? -BLEED : 0;
  const aR = hideRight ? 100 + BLEED : 100;
  const bB = hideBottom ? 100 + BLEED : 100;
  const bL = hideLeft ? -BLEED : 0;
  return (
    <>
      <polygon points={`0,${aT} ${aR},${aT} ${aR},100`} fill={fillA} />
      <polygon points={`${bL},0 ${bL},${bB} 100,${bB}`} fill={fillB} />
      {showCut && <line x1="2" y1="2" x2="98" y2="98" />}
    </>
  );
}

function neswPolygons(fillA, fillB, hideTop, hideRight, hideBottom, hideLeft, showCut) {
  const aT = hideTop ? -BLEED : 0;
  const aL = hideLeft ? -BLEED : 0;
  const bB = hideBottom ? 100 + BLEED : 100;
  const bR = hideRight ? 100 + BLEED : 100;
  return (
    <>
      <polygon points={`${aL},${aT} 100,${aT} ${aL},100`} fill={fillA} />
      <polygon points={`${bR},0 ${bR},${bB} 0,${bB}`} fill={fillB} />
      {showCut && <line x1="98" y1="2" x2="2" y2="98" />}
    </>
  );
}

function mergeBleedShadow(fill, hideTop, hideRight, hideBottom, hideLeft) {
  const shadows = [];
  if (hideTop) shadows.push(`0 -1px 0 0 ${fill}`);
  if (hideRight) shadows.push(`1px 0 0 0 ${fill}`);
  if (hideBottom) shadows.push(`0 1px 0 0 ${fill}`);
  if (hideLeft) shadows.push(`-1px 0 0 0 ${fill}`);
  return shadows.length ? shadows.join(', ') : undefined;
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
          const hideTop = Boolean(mergeBorders?.hideTop);
          const hideBottom = Boolean(mergeBorders?.hideBottom);
          const hideLeft = Boolean(mergeBorders?.hideLeft);
          const hideRight = Boolean(mergeBorders?.hideRight);
          const showDiagonal =
            mergeBorders?.showDiagonal ?? (Boolean(diagonal) && !mergeBorders?.hideDiagonal);

          const fillA = color || CREAM;
          const fillB = diagonal ? cellColorsB?.[index] || CREAM : fillA;

          const className = [
            'abby-patch__pdf-cell',
            showDiagonal ? 'abby-patch__pdf-cell--diagonal' : '',
            hideTop ? 'abby-patch__cell--merge-hide-top' : '',
            hideBottom ? 'abby-patch__cell--merge-hide-bottom' : '',
            hideLeft ? 'abby-patch__cell--merge-hide-left' : '',
            hideRight ? 'abby-patch__cell--merge-hide-right' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const style = showDiagonal
            ? undefined
            : {
                backgroundColor: fillA,
                boxShadow: mergeBleedShadow(fillA, hideTop, hideRight, hideBottom, hideLeft),
              };

          return (
            <div key={index} className={className} style={style}>
              {showDiagonal && (
                <svg
                  className="abby-patch__pdf-cell-diagonal"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {diagonal === 'nwse'
                    ? nwsePolygons(
                        fillA,
                        fillB,
                        hideTop,
                        hideRight,
                        hideBottom,
                        hideLeft,
                        true
                      )
                    : neswPolygons(
                        fillA,
                        fillB,
                        hideTop,
                        hideRight,
                        hideBottom,
                        hideLeft,
                        true
                      )}
                </svg>
              )}
            </div>
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
