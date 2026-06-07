import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import logo from './assets/abby-patch-logo.png';
import FreePatternModal from './components/FreePatternModal';
import FloralDecorations from './components/FloralDecorations';
import PaywallModal from './components/PaywallModal';
import PdfCaptureGrids from './components/PdfCaptureGrids';
import PaletteSwatch from './components/PaletteSwatch';
import QuiltGrid from './components/QuiltGrid';
import YardagePanel from './components/YardagePanel';
import { CREAM, FABRIC_PALETTE, QUILT_SIZE_PRESETS, SIDES } from './constants';
import { generateQuiltPdf } from './generateQuiltPdf';
import { addBlockSelection, applyTileToSelection } from './gridUtils';
import {
  buildCombinedYardageReport,
  buildYardageReport,
  calculateGridDimensions,
  formatDimension,
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
import { openScreenColorPickerWindow, subscribeToScreenColorPicker } from './utils/screenColorPicker';
import './App.css';

function createSideState(rows, columns) {
  const r = Math.max(1, rows);
  const c = Math.max(1, columns);
  return {
    cellColors: Array(r * c).fill(null),
    selectedBlocks: [],
  };
}

function App() {
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [quiltWidth, setQuiltWidth] = useState(60);
  const [quiltHeight, setQuiltHeight] = useState(80);
  const [blockSize, setBlockSize] = useState(6);
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
  const isPaintingRef = useRef(false);

  const activeSideData = sides[activeSide];
  const { cellColors, selectedBlocks } = activeSideData;
  const activeSideLabel = SIDES.find((s) => s.id === activeSide)?.label ?? 'Front';

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

  const handleOpenScreenColorPicker = useCallback(() => {
    setSelectionSource('custom');
    setCustomPickerOpen(true);
    setEraserMode(false);
    openScreenColorPickerWindow();
  }, []);

  useEffect(() => subscribeToScreenColorPicker(handleCustomColorChange), [handleCustomColorChange]);

  const handleGenerate = useCallback(() => {
    const dimensions = calculateGridDimensions(quiltWidth, quiltHeight, blockSize);
    if (!dimensions) {
      window.alert('Please enter valid quilt width, height, and block size.');
      return;
    }

    const { rows: r, columns: c, finishedWidth, finishedHeight, blockSize: block } =
      dimensions;

    setSides({
      front: createSideState(r, c),
      back: createSideState(r, c),
    });
    setGrid({
      rows: r,
      columns: c,
      blockSize: block,
      finishedWidth,
      finishedHeight,
    });
    setEraserMode(false);
    setSelectionMode(false);
  }, [quiltWidth, quiltHeight, blockSize]);

  const handleTilePattern = useCallback(() => {
    if (!grid) return;

    setSides((prev) => {
      const currentSide = prev[activeSide];
      if (!currentSide.selectedBlocks.length) {
        window.alert('Select blocks on the grid first, then tile the pattern within them.');
        return prev;
      }

      return {
        ...prev,
        [activeSide]: {
          ...currentSide,
          cellColors: applyTileToSelection(
            currentSide.cellColors,
            grid.columns,
            currentSide.selectedBlocks
          ),
        },
      };
    });
    setEraserMode(false);
    setSelectionMode(false);
  }, [activeSide, grid]);

  const applyCellStroke = useCallback(
    (index) => {
      if (selectionMode) {
        setSides((prev) => {
          const side = prev[activeSide];
          if (side.selectedBlocks.includes(index)) {
            return prev;
          }
          return {
            ...prev,
            [activeSide]: {
              ...side,
              selectedBlocks: addBlockSelection(side.selectedBlocks, index),
            },
          };
        });
        return;
      }

      const nextColor = eraserMode ? null : selectedColor;
      setSides((prev) => {
        const side = prev[activeSide];
        if (side.cellColors[index] === nextColor) {
          return prev;
        }
        const next = [...side.cellColors];
        next[index] = nextColor;
        return {
          ...prev,
          [activeSide]: { ...side, cellColors: next },
        };
      });
    },
    [activeSide, eraserMode, selectedColor, selectionMode]
  );

  const handleCellPointerDown = useCallback(
    (index) => {
      isPaintingRef.current = true;
      applyCellStroke(index);
    },
    [applyCellStroke]
  );

  const handleCellPointerEnter = useCallback(
    (index) => {
      if (isPaintingRef.current) {
        applyCellStroke(index);
      }
    },
    [applyCellStroke]
  );

  useEffect(() => {
    const stopPainting = () => {
      isPaintingRef.current = false;
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
    };
  }, []);

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

  const handleToggleEraser = useCallback(() => {
    setEraserMode((prev) => {
      if (!prev) {
        setSelectionMode(false);
      }
      return !prev;
    });
  }, []);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (!prev) {
        setEraserMode(false);
      }
      return !prev;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSides((prev) => ({
      ...prev,
      [activeSide]: { ...prev[activeSide], selectedBlocks: [] },
    }));
  }, [activeSide]);

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

  const handleBlockSizeChange = useCallback((event) => {
    setBlockSize(event.target.value);
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
      grid.finishedWidth,
      grid.finishedHeight,
      grid.columns,
      grid.rows
    );
  }, [sides.front.cellColors, sides.back.cellColors, grid]);

  const executePdfDownload = useCallback(async () => {
    if (!grid || !yardageReport?.colors?.length) {
      return;
    }

    const frontReport = buildYardageReport(
      sides.front.cellColors,
      grid.finishedWidth,
      grid.finishedHeight,
      grid.columns,
      grid.rows
    );
    const backReport = buildYardageReport(
      sides.back.cellColors,
      grid.finishedWidth,
      grid.finishedHeight,
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
  }, [grid, sides.front.cellColors, sides.back.cellColors, yardageReport]);

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
      setGrid(restored.grid);
      setSides(restored.sides);
      setQuiltWidth(restored.quiltWidth);
      setQuiltHeight(restored.quiltHeight);
      setBlockSize(restored.blockSize ?? restored.grid?.blockSize ?? 6);
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
        grid,
        sides,
        quiltWidth,
        quiltHeight,
        blockSize,
        quiltSizePreset,
        activeSide,
      });
      await startStripeCheckout({ priceId, mode, email: trimmedEmail });
    } catch (error) {
      console.error('Checkout failed:', error);
      window.alert(error.message || 'Unable to start checkout. Please try again.');
      setCheckoutLoading(false);
    }
  }, [grid, sides, quiltWidth, quiltHeight, blockSize, quiltSizePreset, activeSide]);

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
      <FloralDecorations />
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
            <div className="abby-patch__setup">
              <div className="abby-patch__input-group abby-patch__input-group--full">
                <label htmlFor="quilt-size-preset">Quilt size</label>
                <select
                  id="quilt-size-preset"
                  className="abby-patch__select"
                  value={quiltSizePreset}
                  onChange={handleQuiltSizePresetChange}
                >
                  {QUILT_SIZE_PRESETS.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="abby-patch__setup-dimensions">
                <div className="abby-patch__input-group">
                  <label htmlFor="quilt-width">Quilt width (in)</label>
                  <input
                    id="quilt-width"
                    type="number"
                    min="1"
                    step="0.25"
                    value={quiltWidth}
                    onChange={handleQuiltWidthChange}
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
                    onChange={handleQuiltHeightChange}
                  />
                </div>

                <div className="abby-patch__input-group">
                  <label htmlFor="block-size">Block size (in)</label>
                  <input
                    id="block-size"
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={blockSize}
                    onChange={handleBlockSizeChange}
                  />
                </div>

                <button type="button" className="abby-patch__button" onClick={handleGenerate}>
                  Generate grid
                </button>
              </div>

              {grid && (
                <p className="abby-patch__grid-summary">
                  Your quilt will be approximately{' '}
                  {formatDimension(grid.finishedWidth)}&times;{formatDimension(grid.finishedHeight)}{' '}
                  inches based on {grid.columns}&times;{grid.rows} blocks.
                </p>
              )}
            </div>
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
              className="abby-patch__tabpanel"
            >
              <div className="abby-patch__workspace">
                <div className="abby-patch__sidebar">
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
                        <button
                          type="button"
                          className="abby-patch__tool-button abby-patch__screen-color-button"
                          onClick={handleOpenScreenColorPicker}
                        >
                          Pick from screen
                        </button>
                        <p className="abby-patch__screen-color-hint">
                          Opens a small window so you can sample a color from anywhere on your
                          screen.
                        </p>
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
                      ? 'Eraser on — click or drag to remove color'
                      : 'Click or drag to paint cells with your selected color'}
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
                </div>

                <div className="abby-patch__canvas">
              <section className="abby-patch__grid-wrapper abby-patch__panel">
                <h2 className="abby-patch__section-title abby-patch__grid-title">
                  {activeSideLabel} side
                </h2>
                <QuiltGrid
                  rows={grid.rows}
                  columns={grid.columns}
                  cellColors={cellColors}
                  selectedBlocks={selectedBlocks}
                  suppressRepeatHighlight={suppressRepeatHighlight}
                  eraserMode={eraserMode}
                  selectionMode={selectionMode}
                  sideLabel={activeSideLabel}
                  onCellPointerDown={handleCellPointerDown}
                  onCellPointerEnter={handleCellPointerEnter}
                />
              </section>

              <div className="abby-patch__repeat-yardage">
                <section className="abby-patch__repeat abby-patch__panel" aria-label="Repeat pattern">
                  <h2 className="abby-patch__section-title">Repeat pattern — {activeSideLabel}</h2>
                  <p className="abby-patch__repeat-desc">
                    Turn on Select blocks and drag across the grid like a brush. Color your motif,
                    then tile within the selection only.
                  </p>
                  <div className="abby-patch__repeat-controls">
                    <button
                      type="button"
                      className={`abby-patch__tool-button ${selectionMode ? 'abby-patch__tool-button--active' : ''}`}
                      onClick={handleToggleSelectionMode}
                      aria-pressed={selectionMode}
                    >
                      Select blocks
                    </button>
                    <button
                      type="button"
                      className="abby-patch__tool-button"
                      onClick={handleClearSelection}
                      disabled={!selectedBlocks.length}
                    >
                      Clear selection
                    </button>
                    <button
                      type="button"
                      className="abby-patch__button abby-patch__button--tile"
                      onClick={handleTilePattern}
                      disabled={!selectedBlocks.length}
                    >
                      Tile pattern
                    </button>
                  </div>
                  <p className="abby-patch__repeat-hint">
                    {selectedBlocks.length > 0
                      ? `${selectedBlocks.length} block${selectedBlocks.length === 1 ? '' : 's'} selected — pattern tiles within this area only.`
                      : 'Turn on Select blocks, then click or drag to paint your repeat area.'}
                  </p>
                </section>

                <YardagePanel
                  grid={grid}
                  yardageReport={yardageReport}
                  isDownloadingPdf={isDownloadingPdf}
                  onDownloadPdf={handleDownloadPdf}
                />
              </div>
                </div>
              </div>

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
