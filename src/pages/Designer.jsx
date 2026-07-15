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
  addPieceSelections,
  applyPatternSnapshot,
  extractPatternSnapshot,
  getColoredPieceKeys,
  normalizeSelectedPieces,
  removePieceSelections,
  selectedPiecesToCellIndices,
} from '../gridUtils';
import {
  cellsBetween,
  createEmptyPieceMergeIds,
  dissolveMergesTouchingPieces,
  getMergedPieces,
  getPieceColor,
  mergePieces,
  parsePieceKey,
  pieceKey,
  unmergeSelectedBlocks,
} from '../mergeUtils';
import {
  buildYardageReport,
  BOLT_WIDTH_OPTIONS,
  calculateGridDimensions,
  DEFAULT_BOLT_WIDTH,
  DEFAULT_SEAM_ALLOWANCE,
  formatDimension,
} from '../yardageCalculator';
import { buildFabricPricingReport } from '../utils/fabricPricing';
import { nextDiagonal } from '../triangleUtils';
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
    cellColorsB: Array(cellCount).fill(null),
    cellFabricIds: Array(cellCount).fill(null),
    cellFabricIdsB: Array(cellCount).fill(null),
    cellDiagonals: Array(cellCount).fill(null),
    selectedBlocks: [],
    merges: {},
    cellMergeIds: Array(cellCount).fill(null),
    pieceMergeIds: createEmptyPieceMergeIds(cellCount),
  };
}

function normalizeSideState(side, rows, columns) {
  const cellCount = rows * columns;
  const cellColors =
    side?.cellColors?.length === cellCount
      ? side.cellColors
      : Array(cellCount).fill(null);
  const cellColorsB =
    side?.cellColorsB?.length === cellCount
      ? side.cellColorsB
      : Array(cellCount).fill(null);
  const cellFabricIds =
    side?.cellFabricIds?.length === cellCount
      ? side.cellFabricIds
      : Array(cellCount).fill(null);
  const cellFabricIdsB =
    side?.cellFabricIdsB?.length === cellCount
      ? side.cellFabricIdsB
      : Array(cellCount).fill(null);
  const cellDiagonals =
    side?.cellDiagonals?.length === cellCount
      ? side.cellDiagonals
      : Array(cellCount).fill(null);
  const cellMergeIds =
    side?.cellMergeIds?.length === cellCount
      ? side.cellMergeIds
      : Array(cellCount).fill(null);
  const pieceMergeIds =
    side?.pieceMergeIds?.length === cellCount
      ? side.pieceMergeIds
      : createEmptyPieceMergeIds(cellCount);

  return {
    cellColors,
    cellColorsB,
    cellFabricIds,
    cellFabricIdsB,
    cellDiagonals,
    selectedBlocks: normalizeSelectedPieces(side?.selectedBlocks, cellDiagonals),
    merges: side?.merges ?? {},
    cellMergeIds,
    pieceMergeIds,
  };
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
  const [boltWidth, setBoltWidth] = useState(DEFAULT_BOLT_WIDTH);
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
  const paintHalfRef = useRef(null);
  // One stroke = pointerdown → pointerup. 'paint' | 'merge' | 'select' | 'erase'
  const strokeModeRef = useRef(null);
  const strokeColorRef = useRef(null);
  const strokeVisitedRef = useRef(new Set());
  const mergeStrokeKeysRef = useRef(new Set());
  const lastStrokeCellRef = useRef(null);

  const activeSideData = sides[activeSide];
  const {
    cellColors,
    cellColorsB,
    cellDiagonals,
    selectedBlocks,
    merges,
    cellMergeIds,
    pieceMergeIds,
  } = activeSideData;
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
      selectedPiecesToCellIndices(side.selectedBlocks)
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
            ? selectedPiecesToCellIndices(currentSide.selectedBlocks)
            : []
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

      const cellCount = grid.rows * grid.columns;

      return {
        ...prev,
        [activeSide]: {
          ...currentSide,
          cellColors: result.cellColors,
          // The snapshot only carries base colors + full-cell merges, so the
          // pasted side drops diagonal cuts to stay consistent.
          cellColorsB: Array(cellCount).fill(null),
          cellFabricIdsB: Array(cellCount).fill(null),
          cellDiagonals: Array(cellCount).fill(null),
          merges: result.merges,
          cellMergeIds: result.cellMergeIds,
          pieceMergeIds:
            result.pieceMergeIds ?? createEmptyPieceMergeIds(cellCount),
          selectedBlocks: [],
        },
      };
    });
    setEraserMode(false);
    setSelectionMode(false);
  }, [activeSide, grid, patternClipboard]);

  const applyCellColor = useCallback(
    (index, nextColor, nextFabricId = null, half = null) => {
      setSides((prev) => {
        const side = prev[activeSide];
        const pieces = getMergedPieces(
          index,
          half,
          side.merges,
          side.pieceMergeIds,
          side.cellDiagonals
        );

        let changed = false;
        const nextColors = [...side.cellColors];
        const nextColorsB = [...side.cellColorsB];
        const nextFabricIds = [...side.cellFabricIds];
        const nextFabricIdsB = [...side.cellFabricIdsB];
        let nextMerges = side.merges;

        pieces.forEach(({ index: cellIndex, half: pieceHalf }) => {
          const hasDiagonal = Boolean(side.cellDiagonals[cellIndex]);
          const targetHalf = hasDiagonal ? pieceHalf || half || 'a' : null;

          if (targetHalf === 'b') {
            if (
              nextColorsB[cellIndex] !== nextColor ||
              (nextFabricIdsB[cellIndex] ?? null) !== nextFabricId
            ) {
              nextColorsB[cellIndex] = nextColor;
              nextFabricIdsB[cellIndex] = nextColor ? nextFabricId : null;
              changed = true;
            }
            return;
          }

          if (
            nextColors[cellIndex] !== nextColor ||
            (nextFabricIds[cellIndex] ?? null) !== nextFabricId
          ) {
            nextColors[cellIndex] = nextColor;
            nextFabricIds[cellIndex] = nextColor ? nextFabricId : null;
            changed = true;
          }

          if (!hasDiagonal) {
            if (nextColorsB[cellIndex] != null || nextFabricIdsB[cellIndex] != null) {
              nextColorsB[cellIndex] = null;
              nextFabricIdsB[cellIndex] = null;
              changed = true;
            }
          }

          const mergeId = side.pieceMergeIds[cellIndex]?.a ?? side.cellMergeIds[cellIndex];
          if (mergeId != null && side.merges[mergeId] && targetHalf !== 'b') {
            nextMerges = {
              ...nextMerges,
              [mergeId]: {
                ...nextMerges[mergeId],
                color: nextColor,
              },
            };
          }
        });

        if (!changed) {
          return prev;
        }

        return {
          ...prev,
          [activeSide]: {
            ...side,
            cellColors: nextColors,
            cellColorsB: nextColorsB,
            cellFabricIds: nextFabricIds,
            cellFabricIdsB: nextFabricIdsB,
            merges: nextMerges,
          },
        };
      });
    },
    [activeSide]
  );

  const applyCellStroke = useCallback(
    (index, { allowToggle = false, half = null } = {}) => {
      if (!selectionMode) {
        return;
      }

      setSides((prev) => {
        const side = prev[activeSide];
        const resolvedHalf = side.cellDiagonals[index] ? half || 'a' : null;
        const targetPieces = getMergedPieces(
          index,
          resolvedHalf,
          side.merges,
          side.pieceMergeIds,
          side.cellDiagonals
        );
        const targetKeys = targetPieces.map((piece) =>
          pieceKey(piece.index, piece.half)
        );
        const allSelected = targetKeys.every((key) =>
          side.selectedBlocks.includes(key)
        );

        if (allSelected && !allowToggle) {
          return prev;
        }

        return {
          ...prev,
          [activeSide]: {
            ...side,
            selectedBlocks: allSelected
              ? removePieceSelections(side.selectedBlocks, targetKeys)
              : addPieceSelections(side.selectedBlocks, targetKeys),
          },
        };
      });
    },
    [activeSide, selectionMode]
  );

  const erasePiece = useCallback(
    (index, half = null) => {
      setSides((prev) => {
        const side = prev[activeSide];
        const resolvedHalf = side.cellDiagonals[index] ? half || 'a' : null;
        const pieces = getMergedPieces(
          index,
          resolvedHalf,
          side.merges,
          side.pieceMergeIds,
          side.cellDiagonals
        );

        // Erasing dissolves any merge it touches so no invisible merges linger.
        const dissolved = dissolveMergesTouchingPieces(
          side.merges,
          side.pieceMergeIds,
          pieces
        );

        const nextColors = [...side.cellColors];
        const nextColorsB = [...side.cellColorsB];
        const nextFabricIds = [...side.cellFabricIds];
        const nextFabricIdsB = [...side.cellFabricIdsB];
        let changed = dissolved.merges !== side.merges;

        pieces.forEach(({ index: cellIndex, half: pieceHalf }) => {
          const hasDiagonal = Boolean(side.cellDiagonals[cellIndex]);
          const targetHalf = hasDiagonal ? pieceHalf || 'a' : null;

          if (targetHalf === 'b') {
            if (nextColorsB[cellIndex] != null || nextFabricIdsB[cellIndex] != null) {
              nextColorsB[cellIndex] = null;
              nextFabricIdsB[cellIndex] = null;
              changed = true;
            }
            return;
          }

          if (nextColors[cellIndex] != null || nextFabricIds[cellIndex] != null) {
            nextColors[cellIndex] = null;
            nextFabricIds[cellIndex] = null;
            changed = true;
          }

          if (!hasDiagonal && (nextColorsB[cellIndex] != null || nextFabricIdsB[cellIndex] != null)) {
            nextColorsB[cellIndex] = null;
            nextFabricIdsB[cellIndex] = null;
            changed = true;
          }
        });

        if (!changed) {
          return prev;
        }

        return {
          ...prev,
          [activeSide]: {
            ...side,
            cellColors: nextColors,
            cellColorsB: nextColorsB,
            cellFabricIds: nextFabricIds,
            cellFabricIdsB: nextFabricIdsB,
            merges: dissolved.merges,
            cellMergeIds: dissolved.cellMergeIds,
            pieceMergeIds: dissolved.pieceMergeIds,
          },
        };
      });
    },
    [activeSide]
  );

  /** Add whole blocks (and blocks skipped by fast drags) to the current merge stroke. */
  const collectMergeStrokePiece = useCallback(
    (index) => {
      const side = sides[activeSide];
      const strokeColor = strokeColorRef.current;
      if (!strokeColor) {
        return;
      }

      const path =
        lastStrokeCellRef.current != null && lastStrokeCellRef.current !== index
          ? cellsBetween(lastStrokeCellRef.current, index, grid.columns)
          : [index];

      path.forEach((cellIndex) => {
        // Triangle cells can't merge, so a merge stroke passes over them.
        if (side.cellDiagonals[cellIndex]) {
          return;
        }

        const visitKey = pieceKey(cellIndex, null);
        if (strokeVisitedRef.current.has(visitKey)) {
          return;
        }
        strokeVisitedRef.current.add(visitKey);

        const color = getPieceColor(
          side.cellColors,
          side.cellColorsB,
          side.cellDiagonals,
          cellIndex,
          null
        );
        if (!color || color.toLowerCase() !== strokeColor) {
          return;
        }

        getMergedPieces(
          cellIndex,
          null,
          side.merges,
          side.pieceMergeIds,
          side.cellDiagonals
        ).forEach((piece) => {
          mergeStrokeKeysRef.current.add(pieceKey(piece.index, piece.half));
        });
      });

      lastStrokeCellRef.current = index;

      // Live highlight of what will merge on release.
      const feedback = [...mergeStrokeKeysRef.current];
      setSides((prev) => ({
        ...prev,
        [activeSide]: { ...prev[activeSide], selectedBlocks: feedback },
      }));
    },
    [activeSide, grid, sides]
  );

  const finalizeMergeStroke = useCallback(() => {
    const keys = [...mergeStrokeKeysRef.current];
    mergeStrokeKeysRef.current = new Set();
    strokeColorRef.current = null;

    if (!grid) {
      return;
    }

    setSides((prev) => {
      const side = prev[activeSide];

      if (keys.length < 2) {
        return { ...prev, [activeSide]: { ...side, selectedBlocks: [] } };
      }

      const pieces = keys.map((key) => parsePieceKey(key));
      const result = mergePieces(
        pieces,
        side.cellColors,
        side.cellColorsB,
        side.cellDiagonals,
        grid.columns,
        grid.rows,
        side.merges,
        side.pieceMergeIds
      );

      if (!result.ok) {
        window.alert(result.message);
        return { ...prev, [activeSide]: { ...side, selectedBlocks: [] } };
      }

      return {
        ...prev,
        [activeSide]: {
          ...side,
          merges: result.merges,
          cellMergeIds: result.cellMergeIds,
          pieceMergeIds: result.pieceMergeIds,
          selectedBlocks: [],
        },
      };
    });
  }, [activeSide, grid]);

  const handleCellPointerDown = useCallback(
    (index, half = null) => {
      isPaintingRef.current = true;
      paintHalfRef.current = half ?? null;
      strokeVisitedRef.current = new Set([pieceKey(index, half)]);
      lastStrokeCellRef.current = index;

      if (selectionMode) {
        strokeModeRef.current = 'select';
        applyCellStroke(index, { allowToggle: true, half });
        return;
      }

      if (eraserMode) {
        strokeModeRef.current = 'erase';
        erasePiece(index, half);
        return;
      }

      const side = sides[activeSide];
      const hasDiagonal = Boolean(side.cellDiagonals[index]);
      const resolvedHalf = hasDiagonal ? half || 'a' : null;
      const currentColor = getPieceColor(
        side.cellColors,
        side.cellColorsB,
        side.cellDiagonals,
        index,
        resolvedHalf
      );

      if (
        !hasDiagonal &&
        currentColor &&
        selectedColor &&
        currentColor.toLowerCase() === selectedColor.toLowerCase()
      ) {
        // Dragging across whole blocks already painted the brush color merges
        // them. Triangle cells never merge, so they always paint instead.
        strokeModeRef.current = 'merge';
        strokeColorRef.current = currentColor.toLowerCase();
        mergeStrokeKeysRef.current = new Set();
        getMergedPieces(
          index,
          resolvedHalf,
          side.merges,
          side.pieceMergeIds,
          side.cellDiagonals
        ).forEach((piece) => {
          mergeStrokeKeysRef.current.add(pieceKey(piece.index, piece.half));
        });
        setSides((prev) => ({
          ...prev,
          [activeSide]: {
            ...prev[activeSide],
            selectedBlocks: [...mergeStrokeKeysRef.current],
          },
        }));
        return;
      }

      strokeModeRef.current = 'paint';
      applyCellColor(index, selectedColor, activeFabricId, half);
    },
    [
      activeFabricId,
      activeSide,
      applyCellColor,
      applyCellStroke,
      erasePiece,
      eraserMode,
      selectedColor,
      selectionMode,
      sides,
    ]
  );

  const handleCellDiagonalToggle = useCallback(
    (index) => {
      setSides((prev) => {
        const side = prev[activeSide];
        const nextDiagonalValue = nextDiagonal(side.cellDiagonals[index] ?? null);
        const dissolved = dissolveMergesTouchingPieces(side.merges, side.pieceMergeIds, [
          { index, half: null },
        ]);
        const nextDiagonals = [...side.cellDiagonals];
        const nextColorsB = [...side.cellColorsB];
        const nextFabricIdsB = [...side.cellFabricIdsB];

        nextDiagonals[index] = nextDiagonalValue;
        if (nextDiagonalValue) {
          nextColorsB[index] = side.cellColors[index];
          nextFabricIdsB[index] = side.cellFabricIds[index];
        } else {
          nextColorsB[index] = null;
          nextFabricIdsB[index] = null;
        }

        return {
          ...prev,
          [activeSide]: {
            ...side,
            merges: dissolved.merges,
            cellMergeIds: dissolved.cellMergeIds,
            pieceMergeIds: dissolved.pieceMergeIds,
            cellDiagonals: nextDiagonals,
            cellColorsB: nextColorsB,
            cellFabricIdsB: nextFabricIdsB,
            // Selections referencing this cell's halves are stale after a cut change.
            selectedBlocks: side.selectedBlocks.filter(
              (key) => parsePieceKey(key).index !== index
            ),
          },
        };
      });
    },
    [activeSide]
  );

  const handleCellPointerEnter = useCallback(
    (index, half = null) => {
      if (!isPaintingRef.current) {
        return;
      }

      paintHalfRef.current = half ?? null;
      const strokeMode = strokeModeRef.current;

      if (strokeMode === 'merge') {
        collectMergeStrokePiece(index);
        return;
      }

      const visitKey = pieceKey(index, half);
      if (strokeVisitedRef.current.has(visitKey)) {
        return;
      }
      strokeVisitedRef.current.add(visitKey);
      lastStrokeCellRef.current = index;

      if (strokeMode === 'select') {
        applyCellStroke(index, { half });
        return;
      }

      if (strokeMode === 'erase') {
        erasePiece(index, half);
        return;
      }

      if (strokeMode === 'paint') {
        applyCellColor(index, selectedColor, activeFabricId, half);
      }
    },
    [
      activeFabricId,
      applyCellColor,
      applyCellStroke,
      collectMergeStrokePiece,
      erasePiece,
      selectedColor,
    ]
  );

  const endStroke = useCallback(() => {
    if (strokeModeRef.current === 'merge') {
      finalizeMergeStroke();
    }
    strokeModeRef.current = null;
    strokeVisitedRef.current = new Set();
    lastStrokeCellRef.current = null;
    isPaintingRef.current = false;
    paintHalfRef.current = null;
  }, [finalizeMergeStroke]);

  const handleCellPointerUp = useCallback(() => {
    endStroke();
  }, [endStroke]);

  useEffect(() => {
    const stopPainting = () => {
      if (isPaintingRef.current) {
        endStroke();
      }
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
    };
  }, [endStroke]);

  const handleClearAll = useCallback(() => {
    if (!grid) return;

    setSides((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        cellColors: Array(grid.rows * grid.columns).fill(null),
        cellColorsB: Array(grid.rows * grid.columns).fill(null),
        cellFabricIds: Array(grid.rows * grid.columns).fill(null),
        cellFabricIdsB: Array(grid.rows * grid.columns).fill(null),
        cellDiagonals: Array(grid.rows * grid.columns).fill(null),
        merges: {},
        cellMergeIds: Array(grid.rows * grid.columns).fill(null),
        pieceMergeIds: createEmptyPieceMergeIds(grid.rows * grid.columns),
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
    () =>
      getColoredPieceKeys(cellColors, cellColorsB, cellDiagonals).length,
    [cellColors, cellColorsB, cellDiagonals]
  );

  // Drives smart enable/disable states so buttons only light up when they can act.
  const selectionInfo = useMemo(() => {
    const cellIndices = selectedPiecesToCellIndices(selectedBlocks);
    const mergeableCount = cellIndices.filter((index) => !cellDiagonals[index]).length;
    const hasMergedSelection = cellIndices.some((index) => {
      const ids = pieceMergeIds[index] || { a: null, b: null };
      return ids.a != null || ids.b != null;
    });
    return { mergeableCount, hasMergedSelection };
  }, [selectedBlocks, cellDiagonals, pieceMergeIds]);

  const handleSelectAllColored = useCallback(() => {
    const keys = getColoredPieceKeys(cellColors, cellColorsB, cellDiagonals);
    if (!keys.length) {
      return;
    }

    setSides((prev) => ({
      ...prev,
      [activeSide]: { ...prev[activeSide], selectedBlocks: keys },
    }));
    setSelectionMode(true);
    setEraserMode(false);
  }, [activeSide, cellColors, cellColorsB, cellDiagonals]);

  const handleMergeSquares = useCallback(() => {
    if (!grid) {
      return;
    }

    setSides((prev) => {
      const side = prev[activeSide];
      if (!side.selectedBlocks.length) {
        window.alert('Select at least two colored blocks to merge.');
        return prev;
      }

      const pieces = [];
      const seen = new Set();
      let hadTrianglePieces = false;

      side.selectedBlocks.forEach((key) => {
        const piece =
          typeof key === 'number'
            ? { index: key, half: side.cellDiagonals[key] ? 'a' : null }
            : parsePieceKey(key);

        // Triangle cells never merge — skip them so whole-block merges still work.
        if (side.cellDiagonals[piece.index]) {
          hadTrianglePieces = true;
          return;
        }

        getMergedPieces(
          piece.index,
          piece.half,
          side.merges,
          side.pieceMergeIds,
          side.cellDiagonals
        ).forEach((mergedPiece) => {
          const pieceId = pieceKey(mergedPiece.index, mergedPiece.half);
          if (!seen.has(pieceId)) {
            seen.add(pieceId);
            pieces.push(mergedPiece);
          }
        });
      });

      if (!pieces.length) {
        window.alert(
          hadTrianglePieces
            ? 'Triangles can\u2019t be merged \u2014 they\u2019re cut as individual half-square triangles. Select whole blocks instead.'
            : 'Select colored blocks to merge.'
        );
        return prev;
      }

      const primaryColor = getPieceColor(
        side.cellColors,
        side.cellColorsB,
        side.cellDiagonals,
        pieces[0].index,
        pieces[0].half
      )?.toLowerCase();

      const sameColorPieces = pieces.filter(
        (piece) =>
          getPieceColor(
            side.cellColors,
            side.cellColorsB,
            side.cellDiagonals,
            piece.index,
            piece.half
          )?.toLowerCase() === primaryColor
      );

      if (sameColorPieces.length < 2) {
        window.alert('Select at least two same-color blocks that form a rectangle.');
        return prev;
      }

      const result = mergePieces(
        sameColorPieces,
        side.cellColors,
        side.cellColorsB,
        side.cellDiagonals,
        grid.columns,
        grid.rows,
        side.merges,
        side.pieceMergeIds
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
          pieceMergeIds: result.pieceMergeIds,
          selectedBlocks: [],
        },
      };
    });
  }, [activeSide, grid]);

  const handleUnmergeSquares = useCallback(() => {
    setSides((prev) => {
      const side = prev[activeSide];
      const result = unmergeSelectedBlocks(
        selectedPiecesToCellIndices(side.selectedBlocks),
        side.merges,
        side.cellMergeIds,
        side.pieceMergeIds
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
          pieceMergeIds: result.pieceMergeIds,
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

  const handleBoltWidthChange = useCallback((event) => {
    setBoltWidth(Number(event.target.value) || DEFAULT_BOLT_WIDTH);
  }, []);

  const colorLegend = useMemo(() => {
    const counts = {};
    const tally = (color) => {
      if (color && color.toLowerCase() !== CREAM) {
        const key = color.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    };
    cellColors.forEach(tally);
    cellColorsB.forEach(tally);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [cellColors, cellColorsB]);

  const pricingReport = useMemo(() => {
    if (!grid) return null;
    return buildFabricPricingReport({
      frontCellColors: sides.front.cellColors,
      frontCellFabricIds: sides.front.cellFabricIds,
      frontCellColorsB: sides.front.cellColorsB,
      frontCellDiagonals: sides.front.cellDiagonals,
      frontMerges: sides.front.merges,
      backCellColors: sides.back.cellColors,
      backCellFabricIds: sides.back.cellFabricIds,
      backCellColorsB: sides.back.cellColorsB,
      backCellDiagonals: sides.back.cellDiagonals,
      backMerges: sides.back.merges,
      quiltWidth: grid.finishedWidth,
      quiltHeight: grid.finishedHeight,
      columns: grid.columns,
      rows: grid.rows,
      seamAllowance: Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE,
      fabricWidth: boltWidth,
      fabricCatalog,
    });
  }, [
    sides.front.cellColors,
    sides.front.cellColorsB,
    sides.front.cellFabricIds,
    sides.front.cellDiagonals,
    sides.front.merges,
    sides.back.cellColors,
    sides.back.cellColorsB,
    sides.back.cellFabricIds,
    sides.back.cellDiagonals,
    sides.back.merges,
    grid,
    seamAllowance,
    boltWidth,
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
      Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE,
      {
        cellColorsB: sides.front.cellColorsB,
        cellDiagonals: sides.front.cellDiagonals,
        fabricWidth: boltWidth,
      }
    );
    const backReport = buildYardageReport(
      sides.back.cellColors,
      sides.back.merges,
      grid.finishedWidth,
      grid.finishedHeight,
      grid.columns,
      grid.rows,
      Number(seamAllowance) || DEFAULT_SEAM_ALLOWANCE,
      {
        cellColorsB: sides.back.cellColorsB,
        cellDiagonals: sides.back.cellDiagonals,
        fabricWidth: boltWidth,
      }
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
    sides.front.cellColorsB,
    sides.front.cellDiagonals,
    sides.front.merges,
    sides.back.cellColors,
    sides.back.cellColorsB,
    sides.back.cellDiagonals,
    sides.back.merges,
    yardageReport,
    seamAllowance,
    boltWidth,
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
      if (restored.boltWidth) {
        setBoltWidth(Number(restored.boltWidth) || DEFAULT_BOLT_WIDTH);
      }
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
        boltWidth,
      });
      await startStripeCheckout({ mode, email: trimmedEmail });
    } catch (error) {
      console.error('Checkout failed:', error);
      window.alert(error.message || 'Unable to start checkout. Please try again.');
      setCheckoutLoading(false);
    }
  }, [grid, sides, quiltWidth, quiltHeight, blockSize, quiltSizePreset, activeSide, boltWidth]);

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

              <div className="abby-patch__input-group">
                <label htmlFor="bolt-width">Fabric bolt width</label>
                <select
                  id="bolt-width"
                  className="abby-patch__select"
                  value={boltWidth}
                  onChange={handleBoltWidthChange}
                >
                  {BOLT_WIDTH_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
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
                      : 'Click or drag to paint (triangle halves paint separately). Drag across same-color blocks to merge them. Right click cuts a diagonal. Triangles never merge — each is cut as its own half-square triangle.'}
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
                  cellColorsB={cellColorsB}
                  cellDiagonals={cellDiagonals}
                  merges={merges}
                  cellMergeIds={cellMergeIds}
                  pieceMergeIds={pieceMergeIds}
                  selectedBlocks={selectedBlocks}
                  suppressRepeatHighlight={suppressRepeatHighlight}
                  eraserMode={eraserMode}
                  selectionMode={selectionMode}
                  sideLabel={activeSideLabel}
                  onCellPointerDown={handleCellPointerDown}
                  onCellPointerEnter={handleCellPointerEnter}
                  onCellPointerUp={handleCellPointerUp}
                  onCellDiagonalToggle={handleCellDiagonalToggle}
                />
              </section>

              <div className="abby-patch__pattern-tools">
                <section
                  className="abby-patch__tool-box abby-patch__panel"
                  aria-label="Blocks and patterns"
                >
                  <h2 className="abby-patch__section-title">Blocks &amp; patterns — {activeSideLabel}</h2>
                  <p className="abby-patch__tool-box-desc">
                    Merge joins same-color whole blocks into one rectangular cut piece
                    (triangles always stay separate so the cut list is accurate). Copy and
                    paste tile a selected motif across the quilt.
                  </p>
                  <div className="abby-patch__tool-box-controls">
                    <button
                      type="button"
                      className={`abby-patch__tool-button ${selectionMode ? 'abby-patch__tool-button--active' : ''}`}
                      onClick={handleToggleSelectionMode}
                      aria-pressed={selectionMode}
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      className="abby-patch__tool-button"
                      onClick={handleSelectAllColored}
                      disabled={!coloredBlockCount}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="abby-patch__tool-button"
                      onClick={handleClearSelection}
                      disabled={!selectedBlocks.length}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="abby-patch__tool-button"
                      onClick={handleMergeSquares}
                      disabled={selectionInfo.mergeableCount < 2}
                    >
                      Merge
                    </button>
                    <button
                      type="button"
                      className="abby-patch__tool-button"
                      onClick={handleUnmergeSquares}
                      disabled={!selectionInfo.hasMergedSelection}
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
                        ? `${selectedBlocks.length} selected — ${
                            selectionInfo.mergeableCount >= 2
                              ? 'merge, copy, or paste.'
                              : 'copy or paste (merging needs 2+ whole blocks).'
                          }`
                        : 'Turn on Select, then click blocks or triangle halves.'}
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
                  frontCellColorsB={sides.front.cellColorsB}
                  frontCellDiagonals={sides.front.cellDiagonals}
                  frontMerges={sides.front.merges}
                  frontCellMergeIds={sides.front.cellMergeIds}
                  frontPieceMergeIds={sides.front.pieceMergeIds}
                  backCellColors={sides.back.cellColors}
                  backCellColorsB={sides.back.cellColorsB}
                  backCellDiagonals={sides.back.cellDiagonals}
                  backMerges={sides.back.merges}
                  backCellMergeIds={sides.back.cellMergeIds}
                  backPieceMergeIds={sides.back.pieceMergeIds}
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
