import { memo, useCallback } from 'react';
import { CREAM } from '../constants';
import { getHalfFromPointerEvent } from '../triangleUtils';

function SelectionPoly({ points }) {
  return (
    <polygon
      className="abby-patch__cell-selection-poly"
      points={points}
      aria-hidden="true"
    />
  );
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

  const className = [
    'abby-patch__cell',
    isSelected ? 'abby-patch__cell--selected' : '',
    mergeBorders?.hideTop ? 'abby-patch__cell--merge-hide-top' : '',
    mergeBorders?.hideBottom ? 'abby-patch__cell--merge-hide-bottom' : '',
    mergeBorders?.hideLeft ? 'abby-patch__cell--merge-hide-left' : '',
    mergeBorders?.hideRight ? 'abby-patch__cell--merge-hide-right' : '',
    mergeBorders?.isAnchor ? 'abby-patch__cell--merge-anchor' : '',
    showDiagonal ? 'abby-patch__cell--diagonal' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      style={
        showDiagonal ? { backgroundColor: 'transparent' } : { backgroundColor: fillA }
      }
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
          {diagonal === 'nwse' ? (
            <>
              <polygon points="0,0 100,0 100,100" fill={fillA} />
              <polygon points="0,0 0,100 100,100" fill={fillB} />
              <line x1="0" y1="0" x2="100" y2="100" />
              {selectedA && <SelectionPoly points="0,0 100,0 100,100" />}
              {selectedB && <SelectionPoly points="0,0 0,100 100,100" />}
            </>
          ) : (
            <>
              <polygon points="0,0 100,0 0,100" fill={fillA} />
              <polygon points="100,0 100,100 0,100" fill={fillB} />
              <line x1="100" y1="0" x2="0" y2="100" />
              {selectedA && <SelectionPoly points="0,0 100,0 0,100" />}
              {selectedB && <SelectionPoly points="100,0 100,100 0,100" />}
            </>
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
