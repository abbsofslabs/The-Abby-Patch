import { memo, useCallback } from 'react';
import { CREAM } from '../constants';
import { getHalfFromPointerEvent } from '../triangleUtils';

/** Bleed past a merge-hidden edge so same-color fills underlap the neighbor. */
const BLEED = 1.5;

function SelectionPoly({ points }) {
  return (
    <polygon
      className="abby-patch__cell-selection-poly"
      points={points}
      aria-hidden="true"
    />
  );
}

function nwsePolygons(fillA, fillB, selectedA, selectedB, hideTop, hideRight, hideBottom, hideLeft) {
  // Half A owns top + right; half B owns bottom + left.
  const aT = hideTop ? -BLEED : 0;
  const aR = hideRight ? 100 + BLEED : 100;
  const bB = hideBottom ? 100 + BLEED : 100;
  const bL = hideLeft ? -BLEED : 0;
  const polyA = `0,${aT} ${aR},${aT} ${aR},100`;
  const polyB = `${bL},0 ${bL},${bB} 100,${bB}`;
  return (
    <>
      <polygon points={polyA} fill={fillA} />
      <polygon points={polyB} fill={fillB} />
      {/* Inset the cut line so its stroke never spills into a merged neighbor. */}
      <line x1="2" y1="2" x2="98" y2="98" />
      {selectedA && <SelectionPoly points={polyA} />}
      {selectedB && <SelectionPoly points={polyB} />}
    </>
  );
}

function neswPolygons(fillA, fillB, selectedA, selectedB, hideTop, hideRight, hideBottom, hideLeft) {
  // Half A owns top + left; half B owns bottom + right.
  const aT = hideTop ? -BLEED : 0;
  const aL = hideLeft ? -BLEED : 0;
  const bB = hideBottom ? 100 + BLEED : 100;
  const bR = hideRight ? 100 + BLEED : 100;
  const polyA = `${aL},${aT} 100,${aT} ${aL},100`;
  const polyB = `${bR},0 ${bR},${bB} 0,${bB}`;
  return (
    <>
      <polygon points={polyA} fill={fillA} />
      <polygon points={polyB} fill={fillB} />
      <line x1="98" y1="2" x2="2" y2="98" />
      {selectedA && <SelectionPoly points={polyA} />}
      {selectedB && <SelectionPoly points={polyB} />}
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

function GridCell({
  index,
  color,
  colorB,
  diagonal,
  mergeBorders,
  selectedA,
  selectedB,
  selectedFull,
  sideLabel,
  onCellPointerDown,
  onCellPointerEnter,
  onCellPointerUp,
  onCellDiagonalToggle,
}) {
  const handlePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const half = getHalfFromPointerEvent(event, diagonal);
      onCellPointerDown(index, half);
    },
    [diagonal, index, onCellPointerDown]
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (event.button !== 0) {
        return;
      }
      onCellPointerUp(index);
    },
    [index, onCellPointerUp]
  );

  const handleContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      onCellDiagonalToggle?.(index);
    },
    [index, onCellDiagonalToggle]
  );

  const handlePointerEnter = useCallback(
    (event) => {
      const half = getHalfFromPointerEvent(event, diagonal);
      onCellPointerEnter(index, half);
    },
    [diagonal, index, onCellPointerEnter]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (event.buttons !== 1) {
        return;
      }
      const half = getHalfFromPointerEvent(event, diagonal);
      onCellPointerEnter(index, half);
    },
    [diagonal, index, onCellPointerEnter]
  );

  const fillA = color || CREAM;
  // A cut cell's B half must not inherit A's color, or the whole square looks painted.
  const fillB = diagonal ? colorB || CREAM : fillA;
  const showDiagonal =
    mergeBorders?.showDiagonal ?? (Boolean(diagonal) && !mergeBorders?.hideDiagonal);
  const pieceCount = mergeBorders?.pieceCount ?? 0;
  const mergeLabel =
    mergeBorders?.isAnchor &&
    (pieceCount > 1 || mergeBorders.mergeWidth * mergeBorders.mergeHeight > 1)
      ? `${mergeBorders.mergeWidth}×${mergeBorders.mergeHeight}`
      : null;
  const isSelected = selectedFull || selectedA || selectedB;
  const hideTop = Boolean(mergeBorders?.hideTop);
  const hideBottom = Boolean(mergeBorders?.hideBottom);
  const hideLeft = Boolean(mergeBorders?.hideLeft);
  const hideRight = Boolean(mergeBorders?.hideRight);

  const className = [
    'abby-patch__cell',
    isSelected ? 'abby-patch__cell--selected' : '',
    hideTop ? 'abby-patch__cell--merge-hide-top' : '',
    hideBottom ? 'abby-patch__cell--merge-hide-bottom' : '',
    hideLeft ? 'abby-patch__cell--merge-hide-left' : '',
    hideRight ? 'abby-patch__cell--merge-hide-right' : '',
    mergeBorders?.isAnchor ? 'abby-patch__cell--merge-anchor' : '',
    showDiagonal ? 'abby-patch__cell--diagonal' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cellStyle = showDiagonal
    ? { backgroundColor: 'transparent' }
    : {
        backgroundColor: fillA,
        boxShadow: mergeBleedShadow(fillA, hideTop, hideRight, hideBottom, hideLeft),
      };

  return (
    <button
      type="button"
      className={className}
      style={cellStyle}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      aria-label={`${sideLabel} patch ${index + 1}${color ? `, color ${color}` : ', empty'}${isSelected ? ', selected' : ''}${mergeLabel ? `, merged ${mergeLabel}` : ''}${diagonal ? `, diagonal ${diagonal}` : ''}`}
      aria-pressed={isSelected}
    >
      {showDiagonal && (
        <svg
          className={`abby-patch__cell-diagonal abby-patch__cell-diagonal--${diagonal}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {diagonal === 'nwse'
            ? nwsePolygons(
                fillA,
                fillB,
                selectedA,
                selectedB,
                hideTop,
                hideRight,
                hideBottom,
                hideLeft
              )
            : neswPolygons(
                fillA,
                fillB,
                selectedA,
                selectedB,
                hideTop,
                hideRight,
                hideBottom,
                hideLeft
              )}
        </svg>
      )}
      {mergeLabel && (
        <span className="abby-patch__cell-merge-label" aria-hidden="true">
          {mergeLabel}
        </span>
      )}
      {selectedFull || ((selectedA || selectedB) && !showDiagonal) ? (
        <span className="abby-patch__cell-selection-mark" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export default memo(GridCell);
