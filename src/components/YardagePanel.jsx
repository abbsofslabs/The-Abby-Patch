import { memo } from 'react';
import { formatDimension, formatYards } from '../yardageCalculator';

function YardagePanel({
  grid,
  yardageReport,
  showYardage,
  isDownloadingPdf,
  downloadPricingMessage,
  onDownloadPdf,
}) {
  const hasColoredBlocks = yardageReport && yardageReport.colors.length > 0;

  return (
    <section
      className="abby-patch__yardage abby-patch__panel"
      aria-label={showYardage ? 'Yardage calculator' : 'Download design'}
    >
      <h2 className="abby-patch__section-title">
        {showYardage ? 'Yardage calculator — front & back combined' : 'Download your design'}
      </h2>

      {!showYardage && (
        <p className="abby-patch__yardage-empty">
          When your quilt is colored, download your PDF. The yardage calculator unlocks after your
          first download.
        </p>
      )}

      {showYardage && yardageReport?.blockSize && grid && (
        <p className="abby-patch__block-size">
          Finished quilt:{' '}
          <strong>
            {formatDimension(grid.finishedWidth)}&Prime; &times;{' '}
            {formatDimension(grid.finishedHeight)}&Prime;
          </strong>
          <span className="abby-patch__block-size-detail">
            ({grid.columns}&times;{grid.rows} blocks at{' '}
            {formatDimension(yardageReport.blockSize.width)}&Prime; each)
          </span>
        </p>
      )}

      {showYardage && (
        <p className="abby-patch__yardage-note abby-patch__yardage-note--inline">
          Cut sizes include {formatDimension(0.25)}&Prime; seam allowance on outer edges only (merged
          pieces count as one cut). Yardage uses 44&Prime; usable width, allows rotating rectangles,
          and is rounded up to the nearest &frac14; yard. Totals combine both quilt sides.
        </p>
      )}

      {showYardage && hasColoredBlocks ? (
        <>
          <div className="abby-patch__yardage-table-wrapper">
            <table className="abby-patch__yardage-table">
              <thead>
                <tr>
                  <th scope="col">Color</th>
                  <th scope="col">Front</th>
                  <th scope="col">Back</th>
                  <th scope="col">Total</th>
                  <th scope="col">Sq in*</th>
                  <th scope="col">Yards</th>
                </tr>
              </thead>
              <tbody>
                {yardageReport.colors.map((row) => (
                  <tr key={row.color}>
                    <td>
                      <span className="abby-patch__yardage-color">
                        <span
                          className="abby-patch__swatch"
                          style={{ backgroundColor: row.color }}
                          aria-hidden="true"
                        />
                        <span className="abby-patch__legend-hex">{row.color.toUpperCase()}</span>
                      </span>
                    </td>
                    <td>{row.frontCount}</td>
                    <td>{row.backCount}</td>
                    <td>{row.totalCount}</td>
                    <td>{Math.round(row.sqInWithSeam)}</td>
                    <td>{formatYards(row.yards)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="abby-patch__yardage-subtotal">
                  <td colSpan="5">Front only</td>
                  <td>{formatYards(yardageReport.frontTotalYards)}</td>
                </tr>
                <tr className="abby-patch__yardage-subtotal">
                  <td colSpan="5">Back only</td>
                  <td>{formatYards(yardageReport.backTotalYards)}</td>
                </tr>
                <tr className="abby-patch__yardage-total">
                  <td colSpan="5">Combined total fabric (front + back)</td>
                  <td>{formatYards(yardageReport.totalYards)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="abby-patch__yardage-note">
            *Square inches use cut sizes (including merged rectangles) with outer-edge seam
            allowance, calculated from combined front and back piece counts per color.
          </p>
          <p className="abby-patch__yardage-disclaimer">
            Yardage includes seam allowance and cutting waste. Actual needs may vary slightly.
          </p>
        </>
      ) : (
        showYardage && (
          <p className="abby-patch__yardage-empty">
            Color blocks on the front and/or back to see combined fabric yardage estimates.
          </p>
        )
      )}

      {downloadPricingMessage && (
        <p className="abby-patch__download-pricing">{downloadPricingMessage}</p>
      )}
      {hasColoredBlocks && (
        <button
          type="button"
          className="abby-patch__button abby-patch__button--download"
          onClick={onDownloadPdf}
          disabled={isDownloadingPdf}
        >
          {isDownloadingPdf ? 'Creating PDF…' : 'Download PDF'}
        </button>
      )}
    </section>
  );
}

export default memo(YardagePanel);
