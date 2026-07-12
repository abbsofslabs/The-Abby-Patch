import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import logo from '../assets/abby-patch-logo.png';
import FreePatternModal from '../components/FreePatternModal';
import FloralDecorations from '../components/FloralDecorations';
import PaywallModal from '../components/PaywallModal';
import PdfCaptureGrids from '../components/PdfCaptureGrids';
import PaletteSwatch from '../components/PaletteSwatch';
import QuiltGrid from '../components/QuiltGrid';
import StoreFabricBrowser from '../components/StoreFabricBrowser';
import YardagePanel from '../components/YardagePanel';
import { useAuth } from '../context/AuthContext';
import { CREAM, FABRIC_PALETTE, PAYWALL_ENABLED, QUILT_SIZE_PRESETS, SIDES } from '../constants';
import { generateQuiltPdf } from '../generateQuiltPdf';
import {
  addBlockSelections,
  applyPatternSnapshot,
  extractPatternSnapshot,
  getColoredBlockIndices,
  removeBlockSelections,
} from '../gridUtils';
import {
  getMergedCellIndices,
  mergeSelectedBlocks,
  unmergeSelectedBlocks,
} from '../mergeUtils';
import {
  buildYardageReport,
  calculateGridDimensions,
  DEFAULT_SEAM_ALLOWANCE,
  formatDimension,
} from '../yardageCalculator';
import { buildFabricPricingReport } from '../utils/fabricPricing';
import {
  getUserEmail,
  hasSubscription,
  hasUsedFree,
  setHasSubscription,
  setHasUsedFree,
  setUserEmail,
} from '../utils/accessStorage';
import { startStripeCheckout } from '../utils/stripeCheckout';
import { loadAndClearPatternSession, savePatternSession } from '../utils/patternSession';
import { openScreenColorPickerWindow, subscribeToScreenColorPicker } from '../utils/screenColorPicker';
import '../App.css';

function createSideState(rows, columns) {
  const r = Math.max(1, rows);
  const c = Math.max(1, columns);
  const cellCount = r * c;
  return {
    cellColors: Array(cellCount).fill(null),
    cellFabricIds: Array(cellCount).fill(null),
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
  const cellFabricIds =
    side?.cellFabricIds?.length === cellCount
      ? side.cellFabricIds
      : Array(cellCount).fill(null);
  const cellMergeIds =
    side?.cellMergeIds?.length === cellCount
      ? side.cellMergeIds
      : Array(cellCount).fill(null);

  return {
    cellColors,
    cellFabricIds,
    selectedBlocks: side?.selectedBlocks ?? [],
    merges: side?.merges ?? {},
    cellMergeIds,
  };
}

function isMergeCandidate(indices, cellColors) {
  if (indices.length < 2) {
    return false;
  }

  const colors = indices.map((index) => cellColors[index]?.toLowerCase()).filter(Boolean);
  return colors.length === indices.length && new Set(colors).size === 1;
}

function Designer() {
  const { user, signOut } = useAuth();
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
  const [seamAllowance, setSeamAllowance] = useState(DEFAULT_SEAM_ALLOWANCE);
  const [quiltWidth, setQuiltWidth] = useState(60);
  const [quiltHeight, setQuiltHeight] = useState(80);
  const [blockSize, setBlockSize] = useState(6);
  const [quiltSizePreset, setQuiltSizePreset] = useState('custom');
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedStoreFabric, setSelectedStoreFabric] = useState(null);
  const [fabricCatalog, setFabricCatalog] = useState({});
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [hasDownloadedDesign, setHasDownloadedDesign] = useState(false);
  const [suppressRepeatHighlight, setSuppressRepeatHighlight] = useState(false);
  const [accessModal, setAccessModal] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [savedEmail, setSavedEmail] = useState(() => getUserEmail());
  const [pendingPdfDownload, setPendingPdfDownload] = useState(false);
  const [patternClipboard, setPatternClipboard] = useState({ front: null, back: null });
  const frontGridRef = useRef(null);
  const backGridRef = useRef(null);
  const executePdfDownloadRef = useRef(null);
  const isPaintingRef = useRef(false);
  const cellDragIndicesRef = useRef(new Set());
  const isGridDragRef = useRef(false);

  const activeSideData = sides[activeSide];
  const { cellColors, selectedBlocks, merges, cellMergeIds } = activeSideData;
  const activeSideLabel = SIDES.find((s) => s.id === activeSide)?.label ?? 'Front';
  const copiedPattern = patternClipboard[activeSide];
  const activeFabricId = useMemo(
    () => (selectionSource === 'store' ? selectedStoreFabric?.id ?? null : null),
    [selectionSource, selectedStoreFabric]
  );

  let downloadPricingMessage = null;
  if (PAYWALL_ENABLED && !hasSubscription()) {
    downloadPricingMessage = hasUsedFree()
      ? 'You\u2019ve used your free download. Additional patterns are $2 each or $10/month unlimited.'
      : 'Your first pattern download is free. After that, additional downloads cost money.';
  }

  const handlePresetSelect = useCallback((hex) => {
    setSelectedColor(hex);
    setSelectionSource('preset');
    setSelectedStoreFabric(null);
    setCustomPickerOpen(false);
    setEraserMode(false);
  }, []);

  const handleStoreFabricSelect = useCallback((fabric) => {
    if (!fabric) {
      setSelectedStoreFabric(null);
      return;
    }

    setSelectedStoreFabric(fabric);
    setSelectedColor(fabric.primaryColor);
    setSelectionSource('store');
    setCustomPickerOpen(false);
    setEraserMode(false);
    setFabricCatalog((prev) => ({ ...prev, [fabric.id]: fabric }));
  }, []);

  const handleCustomColorChange = useCallback((hex) => {
    setSelectedColor(hex);
    setSelectionSource('custom');
    setSelectedStoreFabric(null);
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
    setHasDownloadedDesign(false);
  }, [quiltWidth, quiltHeight, blockSize]);

  const handleCopyPattern = useCallback(() => {
    if (!grid) return;

    const side = sides[activeSide];
    const snapshot = extractPatternSnapshot(
      side.cellColors,
      side.merges,
      side.cellMergeIds,
      grid.columns,
      side.selectedBlocks
    );

    if (snapshot.error === 'no_selection') {
      window.alert('Select the blocks that form your pattern first.');
      return;
    }

    if (snapshot.error === 'no_motif') {
      window.alert('Color the selected pattern blocks before copying.');
      return;
    }

    setPatternClipboard((prev) => ({ ...prev, [activeSide]: snapshot }));
    setSides((prev) => ({
      ...prev,
      [activeSide]: { ...prev[activeSide], selectedBlocks: [] },
    }));
    setSelectionMode(false);
  }, [activeSide, grid, sides]);

  const handlePastePattern = useCallback(() => {
    if (!grid) return;

    setSides((prev) => {
      const currentSide = prev[activeSide];
      const snapshot =
        patternClipboard[activeSide] ??
        extractPatternSnapshot(
          currentSide.cellColors,
          currentSide.merges,
          currentSide.cellMergeIds,
          grid.columns,
          currentSide.selectedBlocks
        );

      if (snapshot.error === 'no_selection') {
        window.alert('Select blocks or copy a pattern first.');
        return prev;
      }

      if (snapshot.error === 'no_motif') {
        window.alert('Color the selected pattern blocks before pasting.');
        return prev;
      }

      const result = applyPatternSnapshot(
        currentSide.cellColors,
        grid.rows,
        grid.columns,
        snapshot
      );

      return {
        ...prev,
        [activeSide]: {
          ...currentSide,
          cellColors: result.cellColors,
          merges: result.merges,
          cellMergeIds: result.cellMergeIds,
          selectedBlocks: [],
        },
      };
    });
    setEraserMode(false);
    setSelectionMode(false);
  }, [activeSide, grid, patternClipboard]);

  const applyCellColor = useCallback(
    (index, nextColor, nextFabricId = null) => {
      setSides((prev) => {
        const side = prev[activeSide];
        const targetIndices = getMergedCellIndices(
          index,
          side.merges,
          side.cellMergeIds
        );

        if (
          targetIndices.every(
            (cellIndex) =>
              side.cellColors[cellIndex] === nextColor &&
              (side.cellFabricIds[cellIndex] ?? null) === nextFabricId
          )
        ) {
          return prev;
        }

        const next = [...side.cellColors];
        const nextFabricIds = [...side.cellFabricIds];
        targetIndices.forEach((cellIndex) => {
          next[cellIndex] = nextColor;
          nextFabricIds[cellIndex] = nextColor ? nextFabricId : null;
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
            cellFabricIds: nextFabricIds,
            merges: nextMerges,
          },
        };
      });
    },
    [activeSide]
  );

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

      if (eraserMode) {
        applyCellColor(index, null, null);
      }
    },
    [activeSide, applyCellColor, eraserMode, selectionMode]
  );

  const finalizeCellDrag = useCallback(() => {
    if (!grid || !isGridDragRef.current) {
      return;
    }

    const indices = [...cellDragIndicesRef.current];
    cellDragIndicesRef.current.clear();
    isGridDragRef.current = false;

    if (indices.length < 2) {
      return;
    }

    setSides((prev) => {
      const side = prev[activeSide];

      if (!isMergeCandidate(indices, side.cellColors)) {
        return prev;
      }

      const result = mergeSelectedBlocks(
        side.cellColors,
        indices,
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
        },
      };
    });
  }, [activeSide, grid]);

  const handleCellPointerDown = useCallback(
    (index) => {
      isPaintingRef.current = true;

      if (selectionMode) {
        applyCellStroke(index, { allowToggle: true });
        return;
      }

      if (eraserMode) {
        applyCellStroke(index);
        return;
      }

      isGridDragRef.current = true;
      cellDragIndicesRef.current = new Set([index]);
      applyCellColor(index, selectedColor, activeFabricId);
    },
    [activeFabricId, applyCellColor, applyCellStroke, eraserMode, selectedColor, selectionMode]
  );

  const handleCellPointerEnter = useCallback(
    (index) => {
      if (!isPaintingRef.current) {
        return;
      }

      if (selectionMode || eraserMode) {
        applyCellStroke(index);
        return;
      }

      if (!isGridDragRef.current) {
        return;
      }

      cellDragIndicesRef.current.add(index);
      const indices = [...cellDragIndicesRef.current];

      setSides((prev) => {
        const side = prev[activeSide];

        if (isMergeCandidate(indices, side.cellColors)) {
          return prev;
        }

        const targetIndices = getMergedCellIndices(
          index,
          side.merges,
          side.cellMergeIds
        );

        if (
          targetIndices.every(
            (cellIndex) =>
              side.cellColors[cellIndex] === selectedColor &&
              (side.cellFabricIds[cellIndex] ?? null) === activeFabricId
          )
        ) {
          return prev;
        }

        const next = [...side.cellColors];
        const nextFabricIds = [...side.cellFabricIds];
        targetIndices.forEach((cellIndex) => {
          next[cellIndex] = selectedColor;
          nextFabricIds[cellIndex] = selectedColor ? activeFabricId : null;
        });

        return {
          ...prev,
          [activeSide]: {
            ...side,
            cellColors: next,
            cellFabricIds: nextFabricIds,
          },
        };
      });
    },
    [activeFabricId, activeSide, applyCellStroke, eraserMode, selectedColor, selectionMode]
  );

  const handleCellPointerUp = useCallback(
    (index) => {
      if (selectionMode || eraserMode) {
        isPaintingRef.current = false;
        return;
      }

      if (isGridDragRef.current) {
        finalizeCellDrag();
      }
      isPaintingRef.current = false;
    },
    [eraserMode, finalizeCellDrag, selectionMode]
  );

  useEffect(() => {
    const stopPainting = () => {
      if (isPaintingRef.current && isGridDragRef.current) {
        finalizeCellDrag();
      }
      isPaintingRef.current = false;
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
    };
  }, [finalizeCellDrag]);

  const handleClearAll = useCallback(() => {
    if (!grid) return;

    setSides((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        cellColors: Array(grid.rows * grid.columns).fill(null),
        cellFabricIds: Array(grid.rows * grid.columns).fill(null),
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

  const handleSeamAllowanceChange = useCallback((event) => {
    setSeamAllowance(event.target.value);
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

  const pricingReport = useMemo(() => {
    if (!grid) return null;
    return buildFabricPricingReport({
      frontCellColors: sides.front.cellColors,
      frontCellFabricIds: sides.front.cellFabricIds,
      frontMerges: sides.front.merges,
      backCellColors: sides.back.cellColors,
      backCellFabricIds: sides.back.cellFabricIds,
      backMerges: sides.back.merges,
      quiltWidth: grid.finishedWidth,
      quiltHeight: grid.finishedHeight,
      columns: grid.columns,
      rows: grid.rows,
      seamAllowance: Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE,
      fabricCatalog,
    });
  }, [
    sides.front.cellColors,
    sides.front.cellFabricIds,
    sides.front.merges,
    sides.back.cellColors,
    sides.back.cellFabricIds,
    sides.back.merges,
    grid,
    seamAllowance,
    fabricCatalog,
  ]);

  const yardageReport = pricingReport?.yardageReport ?? null;
  const fabricLines = pricingReport?.fabricLines ?? [];
  const totalFabricCost = pricingReport?.totalFabricCost ?? 0;

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
      grid.rows,
      Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE
    );
    const backReport = buildYardageReport(
      sides.back.cellColors,
      sides.back.merges,
      grid.finishedWidth,
      grid.finishedHeight,
      grid.columns,
      grid.rows,
      Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE
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
      setHasDownloadedDesign(true);
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
    seamAllowance,
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

    if (!PAYWALL_ENABLED) {
      executePdfDownload();
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
      await startStripeCheckout({ mode, email: trimmedEmail });
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
      <div className="abby-patch__main">
        <header className="abby-patch__header">
          <img src={logo} alt="The Abby Patch" className="abby-patch__logo" />
          <p className="abby-patch__store-kicker">Customer account</p>
          <p className="abby-patch__tagline">Design your quilt, one patch at a time</p>
          <div className="abby-patch__header-actions">
            <span className="abby-patch__user-email">{user?.email}</span>
            <button type="button" className="abby-patch__link-button" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
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

              <div className="abby-patch__input-group">
                <label htmlFor="seam-allowance">Seam allowance (in per side)</label>
                <input
                  id="seam-allowance"
                  type="number"
                  min="0"
                  step="0.0625"
                  value={seamAllowance}
                  onChange={handleSeamAllowanceChange}
                />
              </div>

              <button type="button" className="abby-patch__button" onClick={handleGenerate}>
                Generate grid
              </button>
            </div>

            <StoreFabricBrowser
              selectedStore={selectedStore}
              selectedFabric={selectedStoreFabric}
              onSelectStore={setSelectedStore}
              onSelectFabric={handleStoreFabricSelect}
            />

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

                  {selectionSource === 'store' && selectedStoreFabric && (
                    <div className="abby-patch__active-store-fabric">
                      <img
                        src={selectedStoreFabric.imageUrl}
                        alt={selectedStoreFabric.name}
                      />
                      <div>
                        <strong>{selectedStoreFabric.name}</strong>
                        <span>
                          {selectedStore?.store_name} · $
                          {selectedStoreFabric.pricePerYard.toFixed(2)}/yd
                        </span>
                      </div>
                    </div>
                  )}

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
                      : 'Left click or drag to paint. Drag across same-color blocks to merge.'}
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
                  onCellPointerUp={handleCellPointerUp}
                />
              </section>

              <div className="abby-patch__pattern-tools">
                <section
                  className="abby-patch__tool-box abby-patch__panel"
                  aria-label="Copy and paste"
                >
                  <h2 className="abby-patch__section-title">Copy &amp; paste — {activeSideLabel}</h2>
                  <p className="abby-patch__tool-box-desc">
                    Select a pattern, copy it, then paste it across the whole quilt. Use Unmerge on
                    a selected merged block to split it back into squares.
                  </p>
                  <div className="abby-patch__tool-box-controls">
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
                      onClick={handleUnmergeSquares}
                      disabled={!selectedBlocks.length}
                    >
                      Unmerge
                    </button>
                    <button
                      type="button"
                      className="abby-patch__tool-button"
                      onClick={handleCopyPattern}
                      disabled={!selectedBlocks.length}
                    >
                      Copy pattern
                    </button>
                    <button
                      type="button"
                      className="abby-patch__button abby-patch__button--tile"
                      onClick={handlePastePattern}
                      disabled={!copiedPattern && !selectedBlocks.length}
                    >
                      Paste across quilt
                    </button>
                  </div>
                  <p className="abby-patch__tool-box-hint">
                    {copiedPattern
                      ? `${copiedPattern.width}×${copiedPattern.height} pattern ready to paste.`
                      : selectedBlocks.length > 0
                        ? `${selectedBlocks.length} block${selectedBlocks.length === 1 ? '' : 's'} selected — copy or paste across the quilt.`
                        : 'Turn on Select blocks, then click or drag to choose your pattern.'}
                  </p>
                </section>
              </div>

              <div className="abby-patch__yardage-panel-wrap">
                <YardagePanel
                  grid={grid}
                  yardageReport={yardageReport}
                  fabricLines={fabricLines}
                  totalFabricCost={totalFabricCost}
                  seamAllowance={Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE}
                  showYardage={hasDownloadedDesign}
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
      {PAYWALL_ENABLED && accessModal === 'free' && (
        <FreePatternModal
          initialEmail={savedEmail}
          onSubmit={handleFreePatternSubmit}
        />
      )}
      {PAYWALL_ENABLED && accessModal === 'paywall' && (
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

export default Designer;
