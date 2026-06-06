import { useMemo, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import logo from './assets/abby-patch-logo.png';
import {
  MAX_GRID_SIZE,
  buildCombinedYardageReport,
  formatDimension,
  formatYards,
} from './yardageCalculator';
import { applyTilePattern, clampRepeatSize, isInRepeatRegion } from './gridUtils';
import { generateQuiltPdf } from './generateQuiltPdf';
import './App.css';

const CREAM = '#F5F2E9';

const SIDES = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
];

const FABRIC_PALETTE = [
  { name: 'Warm cream', hex: '#F5F0E6' },
  { name: 'Oatmeal', hex: '#EDE4D4' },
  { name: 'Butter yellow', hex: '#E8D4A8' },
  { name: 'Wheat', hex: '#D4C4A0' },
  { name: 'Dusty rose', hex: '#C4898C' },
  { name: 'Mauve rose', hex: '#B87A7E' },
  { name: 'Barn red', hex: '#A84A4A' },
  { name: 'Cranberry', hex: '#8B3A3A' },
  { name: 'Burnt orange', hex: '#C4764E' },
  { name: 'Rust', hex: '#B8654A' },
  { name: 'Taupe brown', hex: '#8B7355' },
  { name: 'Chestnut', hex: '#6B5344' },
  { name: 'Sage green', hex: '#8A9A7B' },
  { name: 'Moss sage', hex: '#6B7F6A' },
  { name: 'Dusty teal', hex: '#5B8A8A' },
  { name: 'Deep teal', hex: '#4A7C7C' },
  { name: 'Deep navy', hex: '#2C3E50' },
  { name: 'Dusty navy', hex: '#4A6670' },
  { name: 'Dusty lavender', hex: '#9B8AA5' },
  { name: 'Soft lilac', hex: '#B5A8C4' },
];

function createSideState(rows, columns, repeatWidth = 2, repeatHeight = 2) {
  const r = Math.max(1, rows);
  const c = Math.max(1, columns);
  return {
    cellColors: Array(r * c).fill(null),
    repeatWidth: Math.min(repeatWidth, c),
    repeatHeight: Math.min(repeatHeight, r),
  };
}

function App() {
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(4);
  const [grid, setGrid] = useState(null);
  const [activeSide, setActiveSide] = useState('front');
  const [sides, setSides] = useState({
    front: createSideState(4, 4),
    back: createSideState(4, 4),
  });
  const [selectedColor, setSelectedColor] = useState(FABRIC_PALETTE[4].hex);
  const [selectionSource, setSelectionSource] = useState('preset');
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [quiltWidth, setQuiltWidth] = useState(60);
  const [quiltHeight, setQuiltHeight] = useState(80);
  const [hasStarted, setHasStarted] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const gridRef = useRef(null);

  const activeSideData = sides[activeSide];
  const { cellColors, repeatWidth, repeatHeight } = activeSideData;
  const activeSideLabel = SIDES.find((s) => s.id === activeSide)?.label ?? 'Front';

  const updateActiveSide = (updater) => {
    setSides((prev) => ({
      ...prev,
      [activeSide]: typeof updater === 'function' ? updater(prev[activeSide]) : updater,
    }));
  };

  const handlePresetSelect = (hex) => {
    setSelectedColor(hex);
    setSelectionSource('preset');
    setCustomPickerOpen(false);
    setEraserMode(false);
  };

  const handleCustomColorChange = (hex) => {
    setSelectedColor(hex);
    setSelectionSource('custom');
    setEraserMode(false);
  };

  const handleCustomColorToggle = () => {
    setCustomPickerOpen((prev) => !prev);
    if (!customPickerOpen) {
      setSelectionSource('custom');
      setEraserMode(false);
    }
  };

  const handleGenerate = () => {
    const r = Math.max(1, Math.min(MAX_GRID_SIZE, Number(rows) || 1));
    const c = Math.max(1, Math.min(MAX_GRID_SIZE, Number(columns) || 1));
    const freshSide = createSideState(r, c, repeatWidth, repeatHeight);
    setGrid({ rows: r, columns: c });
    setSides({
      front: { ...freshSide },
      back: createSideState(r, c, repeatWidth, repeatHeight),
    });
    setEraserMode(false);
  };

  const handleTilePattern = () => {
    if (!grid) return;
    const rw = clampRepeatSize(repeatWidth, grid.columns);
    const rh = clampRepeatSize(repeatHeight, grid.rows);
    updateActiveSide((side) => ({
      ...side,
      repeatWidth: rw,
      repeatHeight: rh,
      cellColors: applyTilePattern(side.cellColors, grid.rows, grid.columns, rw, rh),
    }));
    setEraserMode(false);
  };

  const handleCellClick = (index) => {
    updateActiveSide((side) => {
      const next = [...side.cellColors];
      next[index] = eraserMode ? null : selectedColor;
      return { ...side, cellColors: next };
    });
  };

  const handleClearAll = () => {
    if (!grid) return;
    updateActiveSide((side) => ({
      ...side,
      cellColors: Array(grid.rows * grid.columns).fill(null),
    }));
    setEraserMode(false);
  };

  const setRepeatWidth = (value) => {
    updateActiveSide((side) => ({ ...side, repeatWidth: value }));
  };

  const setRepeatHeight = (value) => {
    updateActiveSide((side) => ({ ...side, repeatHeight: value }));
  };

  const colorLegend = useMemo(() => {
    const counts = {};
    cellColors.forEach((color) => {
      if (color && color.toLowerCase() !== CREAM) {
        const key = color.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [cellColors]);

  const cellCount = grid ? grid.rows * grid.columns : 0;

  const activeRepeatWidth = grid ? clampRepeatSize(repeatWidth, grid.columns) : 1;
  const activeRepeatHeight = grid ? clampRepeatSize(repeatHeight, grid.rows) : 1;

  const yardageReport = useMemo(() => {
    if (!grid) return null;
    return buildCombinedYardageReport(
      sides.front.cellColors,
      sides.back.cellColors,
      quiltWidth,
      quiltHeight,
      grid.columns,
      grid.rows
    );
  }, [sides, grid, quiltWidth, quiltHeight]);

  const handleDownloadPdf = async () => {
    if (!gridRef.current || !yardageReport?.colors?.length) return;

    setIsDownloadingPdf(true);
    try {
      await generateQuiltPdf({
        gridElement: gridRef.current,
        yardageReport,
        sideLabel: activeSideLabel,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="abby-patch">
      {!hasStarted ? (
        <section className="abby-patch__landing">
          <div className="abby-patch__landing-content">
            <p className="abby-patch__landing-eyebrow">Quilt design studio</p>
            <h1 className="abby-patch__landing-title">
              Design your quilt,
              <br />
              one patch at a time
            </h1>
            <p className="abby-patch__landing-desc">
              Plan your layout, pick fabric colors, and calculate yardage — all in one cozy
              place.
            </p>
            <button
              type="button"
              className="abby-patch__button abby-patch__button--start"
              onClick={() => setHasStarted(true)}
            >
              Start now
            </button>
          </div>
          <div className="abby-patch__landing-logo-wrap">
            <img
              src={logo}
              alt="The Abby Patch"
              className="abby-patch__landing-logo"
            />
          </div>
        </section>
      ) : (
      <div className="abby-patch__main">
        <header className="abby-patch__header">
          <img src={logo} alt="The Abby Patch" className="abby-patch__logo" />
          <p className="abby-patch__tagline">Design your quilt, one patch at a time</p>
        </header>

        <div className="abby-patch__tabs" role="tablist" aria-label="Quilt side">
          {SIDES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={activeSide === id}
              aria-controls={`panel-${id}`}
              className={`abby-patch__tab ${activeSide === id ? 'abby-patch__tab--active' : ''}`}
              onClick={() => setActiveSide(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="abby-patch__controls abby-patch__panel">
          <div className="abby-patch__input-group">
            <label htmlFor="rows">Rows</label>
            <input
              id="rows"
              type="number"
              min="1"
              max={MAX_GRID_SIZE}
              value={rows}
              onChange={(e) => setRows(e.target.value)}
            />
          </div>

          <div className="abby-patch__input-group">
            <label htmlFor="columns">Columns</label>
            <input
              id="columns"
              type="number"
              min="1"
              max={MAX_GRID_SIZE}
              value={columns}
              onChange={(e) => setColumns(e.target.value)}
            />
          </div>

          <button type="button" className="abby-patch__button" onClick={handleGenerate}>
            Generate grid
          </button>
        </section>

        {grid && (
          <div
            role="tabpanel"
            id={`panel-${activeSide}`}
            aria-labelledby={`tab-${activeSide}`}
          >
            <section className="abby-patch__tools abby-patch__panel">
              <div className="abby-patch__palette-panel">
                <h2 className="abby-patch__section-title">Choose a fabric — {activeSideLabel}</h2>
                <div className="abby-patch__palette" role="listbox" aria-label="Fabric colors">
                  {FABRIC_PALETTE.map(({ name, hex }) => {
                    const isSelected =
                      selectionSource === 'preset' &&
                      selectedColor.toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        key={hex}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-label={name}
                        className={`abby-patch__palette-swatch ${isSelected ? 'abby-patch__palette-swatch--selected' : ''}`}
                        style={{ backgroundColor: hex }}
                        onClick={() => handlePresetSelect(hex)}
                      />
                    );
                  })}
                </div>

                <div className="abby-patch__custom-color">
                  <button
                    type="button"
                    className={`abby-patch__custom-button ${selectionSource === 'custom' ? 'abby-patch__custom-button--selected' : ''}`}
                    onClick={handleCustomColorToggle}
                    aria-expanded={customPickerOpen}
                  >
                    <span
                      className="abby-patch__custom-preview"
                      style={{
                        backgroundColor:
                          selectionSource === 'custom' ? selectedColor : 'transparent',
                      }}
                      aria-hidden="true"
                    />
                    Custom Color
                  </button>

                  {customPickerOpen && (
                    <div className="abby-patch__custom-picker">
                      <HexColorPicker color={selectedColor} onChange={handleCustomColorChange} />
                      <span className="abby-patch__hex">{selectedColor.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="abby-patch__tool-actions">
                <button
                  type="button"
                  className={`abby-patch__tool-button ${eraserMode ? 'abby-patch__tool-button--active' : ''}`}
                  onClick={() => setEraserMode((prev) => !prev)}
                  aria-pressed={eraserMode}
                >
                  Eraser
                </button>
                <button
                  type="button"
                  className="abby-patch__tool-button abby-patch__tool-button--danger"
                  onClick={handleClearAll}
                >
                  Clear {activeSideLabel.toLowerCase()}
                </button>
                <p className="abby-patch__tool-hint">
                  {eraserMode
                    ? 'Eraser on — click a cell to remove its color'
                    : 'Click any cell to fill it with your selected color'}
                </p>
              </div>
            </section>

            {colorLegend.length > 0 && (
              <section className="abby-patch__legend abby-patch__panel" aria-label="Color legend">
                <h2 className="abby-patch__section-title">Color palette — {activeSideLabel}</h2>
                <ul className="abby-patch__legend-list">
                  {colorLegend.map(([color, count]) => (
                    <li key={color} className="abby-patch__legend-item">
                      <span
                        className="abby-patch__swatch"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="abby-patch__legend-hex">{color.toUpperCase()}</span>
                      <span className="abby-patch__legend-count">
                        {count} {count === 1 ? 'cell' : 'cells'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="abby-patch__repeat abby-patch__panel" aria-label="Repeat pattern">
              <h2 className="abby-patch__section-title">Repeat pattern — {activeSideLabel}</h2>
              <p className="abby-patch__repeat-desc">
                Color the top-left section, then tile it across the whole grid.
              </p>
              <div className="abby-patch__repeat-controls">
                <div className="abby-patch__input-group">
                  <label htmlFor="repeat-width">Repeat width (cells)</label>
                  <input
                    id="repeat-width"
                    type="number"
                    min="1"
                    max={grid.columns}
                    value={repeatWidth}
                    onChange={(e) => setRepeatWidth(e.target.value)}
                  />
                </div>
                <div className="abby-patch__input-group">
                  <label htmlFor="repeat-height">Repeat height (cells)</label>
                  <input
                    id="repeat-height"
                    type="number"
                    min="1"
                    max={grid.rows}
                    value={repeatHeight}
                    onChange={(e) => setRepeatHeight(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="abby-patch__button abby-patch__button--tile"
                  onClick={handleTilePattern}
                >
                  Tile pattern
                </button>
              </div>
              <p className="abby-patch__repeat-hint">
                Highlighted cells ({activeRepeatWidth}&times;{activeRepeatHeight}) are the
                section that will repeat.
              </p>
            </section>

            <section className="abby-patch__grid-wrapper abby-patch__panel">
              <h2 className="abby-patch__section-title abby-patch__grid-title">{activeSideLabel} side</h2>
              <div
                ref={gridRef}
                className={`abby-patch__grid ${eraserMode ? 'abby-patch__grid--eraser' : ''}`}
                style={{
                  gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
                }}
              >
                {Array.from({ length: cellCount }).map((_, i) => {
                  const inRepeatRegion = isInRepeatRegion(
                    i,
                    grid.columns,
                    activeRepeatWidth,
                    activeRepeatHeight
                  );
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`abby-patch__cell ${inRepeatRegion ? 'abby-patch__cell--repeat-region' : ''}`}
                      style={{ backgroundColor: cellColors[i] || CREAM }}
                      onClick={() => handleCellClick(i)}
                      aria-label={`${activeSideLabel} patch ${i + 1}${cellColors[i] ? `, color ${cellColors[i]}` : ', empty'}${inRepeatRegion ? ', repeat source' : ''}`}
                    />
                  );
                })}
              </div>
            </section>

            <section className="abby-patch__yardage abby-patch__panel" aria-label="Yardage calculator">
              <h2 className="abby-patch__section-title">Yardage calculator — front &amp; back combined</h2>

              <div className="abby-patch__yardage-inputs">
                <div className="abby-patch__input-group">
                  <label htmlFor="quilt-width">Quilt width (in)</label>
                  <input
                    id="quilt-width"
                    type="number"
                    min="1"
                    step="0.25"
                    value={quiltWidth}
                    onChange={(e) => setQuiltWidth(e.target.value)}
                  />
                </div>
                <div className="abby-patch__input-group">
                  <label htmlFor="quilt-height">Quilt height (in)</label>
                  <input
                    id="quilt-height"
                    type="number"
                    min="1"
                    step="0.25"
                    value={quiltHeight}
                    onChange={(e) => setQuiltHeight(e.target.value)}
                  />
                </div>
              </div>

              {yardageReport?.blockSize && (
                <p className="abby-patch__block-size">
                  Block size:{' '}
                  <strong>
                    {formatDimension(yardageReport.blockSize.width)}&Prime; &times;{' '}
                    {formatDimension(yardageReport.blockSize.height)}&Prime;
                  </strong>
                  <span className="abby-patch__block-size-detail">
                    ({formatDimension(quiltWidth)}&Prime; &divide; {grid.columns} columns &middot;{' '}
                    {formatDimension(quiltHeight)}&Prime; &divide; {grid.rows} rows)
                  </span>
                </p>
              )}

              <p className="abby-patch__yardage-note abby-patch__yardage-note--inline">
                Square inches include a 10% seam allowance. Yardage is based on 36&Prime; &times; 44&Prime;
                per yard and rounded up to the nearest &frac14; yard. Fabric totals combine both
                quilt sides.
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
                    *Square inches include 10% seam allowance, calculated from combined front and
                    back block counts per color.
                  </p>
                  <p className="abby-patch__yardage-disclaimer">
                    Yardage includes seam allowance and cutting waste. Actual needs may vary
                    slightly.
                  </p>
                  <button
                    type="button"
                    className="abby-patch__button abby-patch__button--download"
                    onClick={handleDownloadPdf}
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
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default App;
