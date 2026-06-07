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
import {
  addBlockSelections,
  applyTileFromSelection,
  getColoredBlockIndices,
  removeBlockSelections,
} from './gridUtils';
import {
  getMergedCellIndices,
  mergeSelectedBlocks,
  unmergeSelectedBlocks,
} from './mergeUtils';
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
  const cellCount = r * c;
  return {
    cellColors: Array(cellCount).fill(null),
    selectedBlocks: [],
    merges: {},
    cellMergeIds: Array(cellCount).fill(null),
  };
}

function normalizeSideState(side, rows, columns) {
  const cellCount = rows * columns;
  const cellColors =
    side?.cellColors?.length === cellCount
      ? side.cellColors
      : Array(cellCount).fill(null);
  const cellMergeIds =
    side?.cellMergeIds?.length === cellCount
      ? side.cellMergeIds
      : Array(cellCount).fill(null);

  return {
    cellColors,
    selectedBlocks: side?.selectedBlocks ?? [],
    merges: side?.merges ?? {},
    cellMergeIds,
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
  const { cellColors, selectedBlocks, merges, cellMergeIds } = activeSideData;
  const activeSideLabel = SIDES.find((s) => s.id === activeSide)?.label ?? 'Front';

  let downloadPricingMessage = null;
  if (!hasSubscription()) {
    downloadPricingMessage = hasUsedFree()
      ? 'You\u2019ve used your free download. Additional patterns are $2 each or $10/month unlimited.'
      : 'Your first pattern download is free. After that, additional downloads cost money.';
  }

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
        window.alert('Select the blocks that form your pattern first.');
        return prev;
      }

      const result = applyTileFromSelection(
        currentSide.cellColors,
        currentSide.merges,
        currentSide.cellMergeIds,
        grid.rows,
        grid.columns,
        currentSide.selectedBlocks
      );

      if (result.error === 'no_motif') {
        window.alert('Color the selected pattern blocks before tiling.');
        return prev;
      }

      if (result.error) {
        return prev;
      }

      return {
        ...prev,
        [activeSide]: {
          ...currentSide,
          cellColors: result.cellColors,
          merges: result.merges,
          cellMergeIds: result.cellMergeIds,
        },
      };
    });
    setEraserMode(false);
    setSelectionMode(false);
  }, [activeSide, grid]);

  const applyCellStroke = useCallback(
    (index, { allowToggle = false } = {}) => {
      if (selectionMode) {
        setSides((prev) => {
          const side = prev[activeSide];
          const targetIndices = getMergedCellIndices(
            index,
            side.merges,
            side.cellMergeIds
          );
          const allSelected = targetIndices.every((cellIndex) =>
            side.selectedBlocks.includes(cellIndex)
          );

          if (allSelected && !allowToggle) {
            return prev;
          }

          return {
            ...prev,
            [activeSide]: {
              ...side,
              selectedBlocks: allSelected
                ? removeBlockSelections(side.selectedBlocks, targetIndices)
                : addBlockSelections(side.selectedBlocks, targetIndices),
            },
          };
        });
        return;
      }

      const nextColor = eraserMode ? null : selectedColor;
      setSides((prev) => {
        const side = prev[activeSide];
        const targetIndices = getMergedCellIndices(
          index,
          side.merges,
          side.cellMergeIds
        );

        if (targetIndices.every((cellIndex) => side.cellColors[cellIndex] === nextColor)) {
          return prev;
        }

        const next = [...side.cellColors];
        targetIndices.forEach((cellIndex) => {
          next[cellIndex] = nextColor;
        });

        const mergeId = side.cellMergeIds[index];
        let nextMerges = side.merges;
        if (mergeId != null && side.merges[mergeId]) {
          nextMerges = {
            ...side.merges,
            [mergeId]: {
              ...side.merges[mergeId],
              color: nextColor,
            },
          };
        }

        return {
          ...prev,
          [activeSide]: {
            ...side,
            cellColors: next,
            merges: nextMerges,
          },
        };
      });
    },
    [activeSide, eraserMode, selectedColor, selectionMode]
  );

  const handleCellPointerDown = useCallback(
    (index) => {
      isPaintingRef.current = true;
      applyCellStroke(index, { allowToggle: selectionMode });
    },
    [applyCellStroke, selectionMode]
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
        merges: {},
        cellMergeIds: Array(grid.rows * grid.columns).fill(null),
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

  const coloredBlockCount = useMemo(
    () => getColoredBlockIndices(cellColors).length,
    [cellColors]
  );

  const handleSelectAllColored = useCallback(() => {
    const indices = getColoredBlockIndices(cellColors);
    if (!indices.length) {
      return;
    }

    setSides((prev) => ({
      ...prev,
      [activeSide]: { ...prev[activeSide], selectedBlocks: indices },
    }));
    setSelectionMode(true);
    setEraserMode(false);
  }, [activeSide, cellColors]);

  const handleMergeSquares = useCallback(() => {
    if (!grid) return;

    setSides((prev) => {
      const side = prev[activeSide];
      const result = mergeSelectedBlocks(
        side.cellColors,
        side.selectedBlocks,
        grid.columns,
        side.merges,
        side.cellMergeIds
      );

      if (!result.ok) {
        window.alert(result.message);
        return prev;
      }

      return {
        ...prev,
        [activeSide]: {
          ...side,
          merges: result.merges,
          cellMergeIds: result.cellMergeIds,
          selectedBlocks: [],
        },
      };
    });
    setSelectionMode(false);
  }, [activeSide, grid]);

  const handleUnmergeSquares = useCallback(() => {
    setSides((prev) => {
      const side = prev[activeSide];
      const result = unmergeSelectedBlocks(
        side.selectedBlocks,
        side.merges,
        side.cellMergeIds
      );

      if (!result.ok) {
        window.alert(result.message);
        return prev;
      }

      return {
        ...prev,
        [activeSide]: {
          ...side,
          merges: result.merges,
          cellMergeIds: result.cellMergeIds,
          selectedBlocks: [],
        },
      };
    });
    setSelectionMode(false);
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
      sides.front.merges,
      sides.back.cellColors,
      sides.back.merges,
      grid.finishedWidth,
      grid.finishedHeight,
      grid.columns,
      grid.rows
    );
  }, [
    sides.front.cellColors,
    sides.front.merges,
    sides.back.cellColors,
    sides.back.merges,
    grid,
  ]);

  const executePdfDownload = useCallback(async () => {
    if (!grid || !yardageReport?.colors?.length) {
      return;
    }

    const frontReport = buildYardageReport(
      sides.front.cellColors,
      sides.front.merges,
      grid.finishedWidth,
      grid.finishedHeight,
      grid.columns,
      grid.rows
    );
    const backReport = buildYardageReport(
      sides.back.cellColors,
      sides.back.merges,
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
  }, [
    grid,
    sides.front.cellColors,
    sides.front.merges,
    sides.back.cellColors,
    sides.back.merges,
    yardageReport,
  ]);

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
      setSides({
        front: normalizeSideState(restored.sides.front, restored.grid.rows, restored.grid.columns),
        back: normalizeSideState(restored.sides.back, restored.grid.rows, restored.grid.columns),
      });
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
      window.alert(
        'Stripe price ID is not loaded. Check .env.local, then stop and restart npm start.'
      );
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
                  merges={merges}
                  cellMergeIds={cellMergeIds}
                  selectedBlocks={selectedBlocks}
                  suppressRepeatHighlight={suppressRepeatHighlight}
                  eraserMode={eraserMode}
                  selectionMode={selectionMode}
                  sideLabel={activeSideLabel}
                  onCellPointerDown={handleCellPointerDown}
                  onCellPointerEnter={handleCellPointerEnter}
                />
              </section>

              <section className="abby-patch__repeat abby-patch__panel" aria-label="Repeat pattern">
                <h2 className="abby-patch__section-title">Repeat pattern — {activeSideLabel}</h2>
                <p className="abby-patch__repeat-desc">
                  Select the blocks that make up your pattern, color them, then tile across the
                  whole quilt.
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
                    onClick={handleSelectAllColored}
                    disabled={!coloredBlockCount}
                  >
                    Select all colored
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
                    className="abby-patch__tool-button"
                    onClick={handleMergeSquares}
                    disabled={!selectedBlocks.length}
                  >
                    Merge squares
                  </button>
                  <button
                    type="button"
                    className="abby-patch__tool-button"
                    onClick={handleUnmergeSquares}
                    disabled={!selectedBlocks.length}
                  >
                    Unmerge
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
                    ? `${selectedBlocks.length} block${selectedBlocks.length === 1 ? '' : 's'} selected — merge same-color rectangles, or tile as a repeating pattern.`
                    : 'Turn on Select blocks, then click or drag to choose blocks. Click a selected block again to deselect it.'}
                </p>
              </section>

              <div className="abby-patch__yardage-panel-wrap">
                <YardagePanel
                  grid={grid}
                  yardageReport={yardageReport}
                  isDownloadingPdf={isDownloadingPdf}
                  downloadPricingMessage={downloadPricingMessage}
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
                  frontMerges={sides.front.merges}
                  frontCellMergeIds={sides.front.cellMergeIds}
                  backCellColors={sides.back.cellColors}
                  backMerges={sides.back.merges}
                  backCellMergeIds={sides.back.cellMergeIds}
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
