import { useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import logo from './assets/abby-patch-logo.png';
import {
  MAX_GRID_SIZE,
  buildYardageReport,
  formatDimension,
  formatYards,
} from './yardageCalculator';
import './App.css';

const CREAM = '#F5F2E9';

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

function App() {
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(4);
  const [grid, setGrid] = useState(null);
  const [cellColors, setCellColors] = useState([]);
  const [selectedColor, setSelectedColor] = useState(FABRIC_PALETTE[4].hex);
  const [selectionSource, setSelectionSource] = useState('preset');
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [quiltWidth, setQuiltWidth] = useState(60);
  const [quiltHeight, setQuiltHeight] = useState(80);
  const [hasStarted, setHasStarted] = useState(false);

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
    setGrid({ rows: r, columns: c });
    setCellColors(Array(r * c).fill(null));
    setEraserMode(false);
  };

  const handleCellClick = (index) => {
    setCellColors((prev) => {
      const next = [...prev];
      next[index] = eraserMode ? null : selectedColor;
      return next;
    });
  };

  const handleClearAll = () => {
    if (!grid) return;
    setCellColors(Array(grid.rows * grid.columns).fill(null));
    setEraserMode(false);
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

  const yardageReport = useMemo(() => {
    if (!grid) return null;
    return buildYardageReport(
      cellColors,
      quiltWidth,
      quiltHeight,
      grid.columns,
      grid.rows
    );
  }, [cellColors, grid, quiltWidth, quiltHeight]);

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
          <>
            <section className="abby-patch__tools abby-patch__panel">
              <div className="abby-patch__palette-panel">
                <h2 className="abby-patch__section-title">Choose a fabric</h2>
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
                  Clear board
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
                <h2 className="abby-patch__section-title">Color palette</h2>
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

            <section className="abby-patch__grid-wrapper abby-patch__panel">
              <div
                className={`abby-patch__grid ${eraserMode ? 'abby-patch__grid--eraser' : ''}`}
                style={{
                  gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
                }}
              >
                {Array.from({ length: cellCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="abby-patch__cell"
                    style={{ backgroundColor: cellColors[i] || CREAM }}
                    onClick={() => handleCellClick(i)}
                    aria-label={`Patch ${i + 1}${cellColors[i] ? `, color ${cellColors[i]}` : ', empty'}`}
                  />
                ))}
              </div>
            </section>

            <section className="abby-patch__yardage abby-patch__panel" aria-label="Yardage calculator">
              <h2 className="abby-patch__section-title">Yardage calculator</h2>

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
                per yard and rounded up to the nearest &frac14; yard.
              </p>

              {yardageReport && yardageReport.colors.length > 0 ? (
                <>
                  <div className="abby-patch__yardage-table-wrapper">
                    <table className="abby-patch__yardage-table">
                      <thead>
                        <tr>
                          <th scope="col">Color</th>
                          <th scope="col">Blocks</th>
                          <th scope="col">Sq in*</th>
                          <th scope="col">Blocks / 44&Prime; strip</th>
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
                            <td>{row.count}</td>
                            <td>{Math.round(row.sqInWithSeam)}</td>
                            <td>
                              {row.blocksPerRow}
                              {row.hasCuttingWaste ? '*' : ''}
                            </td>
                            <td>{formatYards(row.yards)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4">Total fabric</td>
                          <td>{formatYards(yardageReport.totalYards)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="abby-patch__yardage-note">
                    *Square inches include 10% seam allowance. Asterisk on blocks per strip
                    indicates extra yardage for width cutting waste.
                  </p>
                  <p className="abby-patch__yardage-disclaimer">
                    Yardage includes seam allowance and cutting waste. Actual needs may vary
                    slightly.
                  </p>
                </>
              ) : (
                <p className="abby-patch__yardage-empty">
                  Color some blocks on the grid to see fabric yardage estimates.
                </p>
              )}
            </section>
          </>
        )}
      </div>
      )}
    </div>
  );
}

export default App;
