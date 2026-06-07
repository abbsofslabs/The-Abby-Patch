import { memo } from 'react';
import { formatDimension, formatYards } from '../yardageCalculator';

function YardagePanel({ grid, yardageReport, isDownloadingPdf, onDownloadPdf }) {
  return (
    <section className="abby-patch__yardage abby-patch__panel" aria-label="Yardage calculator">
      <h2 className="abby-patch__section-title">Yardage calculator — front &amp; back combined</h2>

      {yardageReport?.blockSize && grid && (
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

      <p className="abby-patch__yardage-note abby-patch__yardage-note--inline">
        Square inches are based on cut sizes with {formatDimension(0.25)}&Prime; seam allowance per
        side. Yardage is based on 36&Prime; &times; 44&Prime; per yard and rounded up to the
        nearest &frac14; yard. Fabric totals combine both quilt sides.
      </p>

      {yardageReport && yardageReport.colors.length > 0 ? (
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
            *Square inches use cut block sizes with {formatDimension(0.25)}&Prime; seam allowance
            per side, calculated from combined front and back block counts per color.
          </p>
          <p className="abby-patch__yardage-disclaimer">
            Yardage includes seam allowance and cutting waste. Actual needs may vary slightly.
          </p>
          <button
            type="button"
            className="abby-patch__button abby-patch__button--download"
            onClick={onDownloadPdf}
            disabled={isDownloadingPdf}
          >
            {isDownloadingPdf ? 'Creating PDF…' : 'Download PDF'}
          </button>
        </>
      ) : (
        <p className="abby-patch__yardage-empty">
          Color blocks on the front and/or back to see combined fabric yardage estimates.
        </p>
      )}
    </section>
  );
}

export default memo(YardagePanel);
