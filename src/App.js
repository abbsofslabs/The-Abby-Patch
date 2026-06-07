import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import logo from './assets/abby-patch-logo.png';
import FreePatternModal from './components/FreePatternModal';
import PaywallModal from './components/PaywallModal';
import PdfCaptureGrids from './components/PdfCaptureGrids';
import PaletteSwatch from './components/PaletteSwatch';
import QuiltGrid from './components/QuiltGrid';
import YardagePanel from './components/YardagePanel';
import { CREAM, FABRIC_PALETTE, QUILT_SIZE_PRESETS, SIDES } from './constants';
import { generateQuiltPdf } from './generateQuiltPdf';
import { applyTilePattern, clampRepeatSize } from './gridUtils';
import {
  MAX_GRID_SIZE,
  buildCombinedYardageReport,
  buildYardageReport,
} from './yardageCalculator';
import {
  getUserEmail,
  hasSubscription,
  hasUsedFree,
  setHasSubscription,
  setHasUsedFree,
  setUserEmail,
} from './utils/accessStorage';
import { startStripeCheckout } from './utils/stripeCheckout';
import { loadAndClearPatternSession, savePatternSession } from './utils/patternSession';
import './App.css';

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
  const [quiltSizePreset, setQuiltSizePreset] = useState('custom');
  const [hasStarted, setHasStarted] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [suppressRepeatHighlight, setSuppressRepeatHighlight] = useState(false);
  const [accessModal, setAccessModal] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [savedEmail, setSavedEmail] = useState(() => getUserEmail());
  const [pendingPdfDownload, setPendingPdfDownload] = useState(false);
  const frontGridRef = useRef(null);
  const backGridRef = useRef(null);
  const executePdfDownloadRef = useRef(null);

  const activeSideData = sides[activeSide];
  const { cellColors, repeatWidth, repeatHeight } = activeSideData;
  const activeSideLabel = SIDES.find((s) => s.id === activeSide)?.label ?? 'Front';

  const activeRepeatWidth = grid ? clampRepeatSize(repeatWidth, grid.columns) : 1;
  const activeRepeatHeight = grid ? clampRepeatSize(repeatHeight, grid.rows) : 1;

  const handleStart = useCallback(() => setHasStarted(true), []);

  const handlePresetSelect = useCallback((hex) => {
    setSelectedColor(hex);
    setSelectionSource('preset');
    setCustomPickerOpen(false);
    setEraserMode(false);
  }, []);

  const handleCustomColorChange = useCallback((hex) => {
    setSelectedColor(hex);
    setSelectionSource('custom');
    setEraserMode(false);
  }, []);

  const handleCustomColorToggle = useCallback(() => {
    setCustomPickerOpen((prev) => {
      if (!prev) {
        setSelectionSource('custom');
        setEraserMode(false);
      }
      return !prev;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const r = Math.max(1, Math.min(MAX_GRID_SIZE, Number(rows) || 1));
    const c = Math.max(1, Math.min(MAX_GRID_SIZE, Number(columns) || 1));

    setSides((prevSides) => {
      const activeRepeatW = prevSides[activeSide].repeatWidth;
      const activeRepeatH = prevSides[activeSide].repeatHeight;
      const freshSide = createSideState(r, c, activeRepeatW, activeRepeatH);
      return {
        front: { ...freshSide },
        back: createSideState(r, c, activeRepeatW, activeRepeatH),
      };
    });
    setGrid({ rows: r, columns: c });
    setEraserMode(false);
  }, [rows, columns, activeSide]);

  const handleTilePattern = useCallback(() => {
    if (!grid) return;

    setSides((prev) => {
      const side = prev[activeSide];
      const rw = clampRepeatSize(side.repeatWidth, grid.columns);
      const rh = clampRepeatSize(side.repeatHeight, grid.rows);
      return {
        ...prev,
        [activeSide]: {
          ...side,
          repeatWidth: rw,
          repeatHeight: rh,
          cellColors: applyTilePattern(side.cellColors, grid.rows, grid.columns, rw, rh),
        },
      };
    });
    setEraserMode(false);
  }, [activeSide, grid]);

  const handleCellClick = useCallback(
    (index) => {
      setSides((prev) => {
        const side = prev[activeSide];
        const next = [...side.cellColors];
        next[index] = eraserMode ? null : selectedColor;
        return {
          ...prev,
          [activeSide]: { ...side, cellColors: next },
        };
      });
    },
    [activeSide, eraserMode, selectedColor]
  );

  const handleClearAll = useCallback(() => {
    if (!grid) return;

    setSides((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        cellColors: Array(grid.rows * grid.columns).fill(null),
      },
    }));
    setEraserMode(false);
  }, [activeSide, grid]);

  const handleRepeatWidthChange = useCallback(
    (event) => {
      const value = event.target.value;
      setSides((prev) => ({
        ...prev,
        [activeSide]: { ...prev[activeSide], repeatWidth: value },
      }));
    },
    [activeSide]
  );

  const handleRepeatHeightChange = useCallback(
    (event) => {
      const value = event.target.value;
      setSides((prev) => ({
        ...prev,
        [activeSide]: { ...prev[activeSide], repeatHeight: value },
      }));
    },
    [activeSide]
  );

  const handleToggleEraser = useCallback(() => {
    setEraserMode((prev) => !prev);
  }, []);

  const handleQuiltWidthChange = useCallback((event) => {
    setQuiltWidth(event.target.value);
    setQuiltSizePreset('custom');
  }, []);

  const handleQuiltHeightChange = useCallback((event) => {
    setQuiltHeight(event.target.value);
    setQuiltSizePreset('custom');
  }, []);

  const handleQuiltSizePresetChange = useCallback((event) => {
    const presetId = event.target.value;
    setQuiltSizePreset(presetId);

    const preset = QUILT_SIZE_PRESETS.find((item) => item.id === presetId);
    if (preset?.width && preset?.height) {
      setQuiltWidth(preset.width);
      setQuiltHeight(preset.height);
    }
  }, []);

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
  }, [
    sides.front.cellColors,
    sides.back.cellColors,
    grid,
    quiltWidth,
    quiltHeight,
  ]);

  const executePdfDownload = useCallback(async () => {
    if (!grid || !yardageReport?.colors?.length) {
      return;
    }

    const frontReport = buildYardageReport(
      sides.front.cellColors,
      quiltWidth,
      quiltHeight,
      grid.columns,
      grid.rows
    );
    const backReport = buildYardageReport(
      sides.back.cellColors,
      quiltWidth,
      quiltHeight,
      grid.columns,
      grid.rows
    );

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    flushSync(() => {
      setIsDownloadingPdf(true);
      setSuppressRepeatHighlight(true);
    });

    try {
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      if (!frontGridRef.current || !backGridRef.current) {
        throw new Error('PDF capture grids were not ready.');
      }

      await generateQuiltPdf({
        logoSrc: logo,
        frontGridElement: frontGridRef.current,
        backGridElement: backGridRef.current,
        frontReport,
        backReport,
        combinedReport: yardageReport,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      flushSync(() => {
        setSuppressRepeatHighlight(false);
        setIsDownloadingPdf(false);
      });
    }
  }, [grid, quiltWidth, quiltHeight, sides.front.cellColors, sides.back.cellColors, yardageReport]);

  executePdfDownloadRef.current = executePdfDownload;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') {
      return;
    }

    if (params.get('type') === 'subscription') {
      setHasSubscription(true);
    }

    const restored = loadAndClearPatternSession();
    if (restored) {
      setHasStarted(true);
      setRows(restored.rows);
      setColumns(restored.columns);
      setGrid(restored.grid);
      setSides(restored.sides);
      setQuiltWidth(restored.quiltWidth);
      setQuiltHeight(restored.quiltHeight);
      setQuiltSizePreset(restored.quiltSizePreset);
      setActiveSide(restored.activeSide);
    }

    window.history.replaceState({}, '', window.location.pathname);
    setPendingPdfDownload(true);
  }, []);

  useEffect(() => {
    if (!pendingPdfDownload || !grid || !yardageReport?.colors?.length) {
      return;
    }
    setPendingPdfDownload(false);
    executePdfDownload();
  }, [pendingPdfDownload, grid, yardageReport, executePdfDownload]);

  const handleDownloadPdf = useCallback(() => {
    if (!grid || !yardageReport?.colors?.length) {
      return;
    }

    if (hasSubscription()) {
      executePdfDownload();
      return;
    }

    if (!hasUsedFree()) {
      setAccessModal('free');
      return;
    }

    setAccessModal('paywall');
  }, [executePdfDownload, grid, yardageReport]);

  const handleFreePatternSubmit = useCallback(
    (email) => {
      setUserEmail(email);
      setSavedEmail(email);
      setHasUsedFree();
      setAccessModal(null);
      executePdfDownload();
    },
    [executePdfDownload]
  );

  const handlePaywallCheckout = useCallback(async (mode, email) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      window.alert('Please enter a valid email address before checkout.');
      return;
    }

    setUserEmail(trimmedEmail);
    setSavedEmail(trimmedEmail);

    const priceId =
      mode === 'subscription'
        ? process.env.REACT_APP_STRIPE_SUB
        : process.env.REACT_APP_STRIPE_SINGLE;

    if (!priceId) {
      window.alert('Stripe price ID is not configured.');
      return;
    }

    setCheckoutLoading(true);
    try {
      savePatternSession({
        rows,
        columns,
        grid,
        sides,
        quiltWidth,
        quiltHeight,
        quiltSizePreset,
        activeSide,
      });
      await startStripeCheckout({ priceId, mode, email: trimmedEmail });
    } catch (error) {
      console.error('Checkout failed:', error);
      window.alert(error.message || 'Unable to start checkout. Please try again.');
      setCheckoutLoading(false);
    }
  }, [rows, columns, grid, sides, quiltWidth, quiltHeight, quiltSizePreset, activeSide]);

  const handlePaySingle = useCallback(
    (email) => {
      handlePaywallCheckout('payment', email);
    },
    [handlePaywallCheckout]
  );

  const handleSubscribe = useCallback(
    (email) => {
      handlePaywallCheckout('subscription', email);
    },
    [handlePaywallCheckout]
  );

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
              onClick={handleStart}
            >
              Start now
            </button>
          </div>
          <div className="abby-patch__landing-logo-wrap">
            <img src={logo} alt="The Abby Patch" className="abby-patch__landing-logo" />
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

            <div
              role="tabpanel"
              id={`panel-${activeSide}`}
              aria-labelledby={`tab-${activeSide}`}
            >
              <section className="abby-patch__tools abby-patch__panel">
                <div className="abby-patch__palette-panel">
                  <h2 className="abby-patch__section-title">Choose a fabric — {activeSideLabel}</h2>
                  <div className="abby-patch__palette" role="listbox" aria-label="Fabric colors">
                    {FABRIC_PALETTE.map(({ name, hex, light }) => (
                      <PaletteSwatch
                        key={hex}
                        name={name}
                        hex={hex}
                        isLight={light}
                        isSelected={
                          selectionSource === 'preset' &&
                          selectedColor.toLowerCase() === hex.toLowerCase()
                        }
                        onSelect={handlePresetSelect}
                      />
                    ))}
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
                        <HexColorPicker
                          color={selectedColor}
                          onChange={handleCustomColorChange}
                        />
                        <span className="abby-patch__hex">{selectedColor.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="abby-patch__tool-actions">
                  <button
                    type="button"
                    className={`abby-patch__tool-button ${eraserMode ? 'abby-patch__tool-button--active' : ''}`}
                    onClick={handleToggleEraser}
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
                      onChange={handleRepeatWidthChange}
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
                      onChange={handleRepeatHeightChange}
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
                <h2 className="abby-patch__section-title abby-patch__grid-title">
                  {activeSideLabel} side
                </h2>
                <QuiltGrid
                  rows={grid.rows}
                  columns={grid.columns}
                  cellColors={cellColors}
                  repeatWidth={activeRepeatWidth}
                  repeatHeight={activeRepeatHeight}
                  suppressRepeatHighlight={suppressRepeatHighlight}
                  eraserMode={eraserMode}
                  sideLabel={activeSideLabel}
                  onCellClick={handleCellClick}
                />
              </section>

              <YardagePanel
                grid={grid}
                quiltWidth={quiltWidth}
                quiltHeight={quiltHeight}
                quiltSizePreset={quiltSizePreset}
                yardageReport={yardageReport}
                isDownloadingPdf={isDownloadingPdf}
                onDownloadPdf={handleDownloadPdf}
                onQuiltWidthChange={handleQuiltWidthChange}
                onQuiltHeightChange={handleQuiltHeightChange}
                onQuiltSizePresetChange={handleQuiltSizePresetChange}
              />

              {isDownloadingPdf && (
                <PdfCaptureGrids
                  frontGridRef={frontGridRef}
                  backGridRef={backGridRef}
                  rows={grid.rows}
                  columns={grid.columns}
                  frontCellColors={sides.front.cellColors}
                  backCellColors={sides.back.cellColors}
                  isExporting={suppressRepeatHighlight}
                />
              )}
            </div>
            </>
          )}
        </div>
      )}
      {accessModal === 'free' && (
        <FreePatternModal
          initialEmail={savedEmail}
          onSubmit={handleFreePatternSubmit}
        />
      )}
      {accessModal === 'paywall' && (
        <PaywallModal
          initialEmail={savedEmail}
          onClose={() => setAccessModal(null)}
          onPaySingle={handlePaySingle}
          onSubscribe={handleSubscribe}
          isCheckoutLoading={checkoutLoading}
        />
      )}
    </div>
  );
}

export default App;
