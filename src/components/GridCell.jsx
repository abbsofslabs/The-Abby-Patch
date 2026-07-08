import { memo, useCallback } from 'react';
import { CREAM } from '../constants';

function GridCell({
  index,
  color,
  mergeBorders,
  isSelected,
  sideLabel,
  onCellPointerDown,
  onCellPointerEnter,
  onCellPointerUp,
}) {
  const handlePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      onCellPointerDown(index);
    },
    [index, onCellPointerDown]
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

  const handleContextMenu = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handlePointerEnter = useCallback(() => {
    onCellPointerEnter(index);
  }, [index, onCellPointerEnter]);

  const backgroundColor = color || CREAM;
  const className = [
    'abby-patch__cell',
    isSelected ? 'abby-patch__cell--selected' : '',
    mergeBorders?.hideTop ? 'abby-patch__cell--merge-hide-top' : '',
    mergeBorders?.hideBottom ? 'abby-patch__cell--merge-hide-bottom' : '',
    mergeBorders?.hideLeft ? 'abby-patch__cell--merge-hide-left' : '',
    mergeBorders?.hideRight ? 'abby-patch__cell--merge-hide-right' : '',
    mergeBorders?.isAnchor ? 'abby-patch__cell--merge-anchor' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const mergeLabel =
    mergeBorders?.isAnchor && mergeBorders.mergeWidth * mergeBorders.mergeHeight > 1
      ? `${mergeBorders.mergeWidth}×${mergeBorders.mergeHeight}`
      : null;

  return (
    <button
      type="button"
      className={className}
      style={{ backgroundColor }}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      aria-label={`${sideLabel} patch ${index + 1}${color ? `, color ${color}` : ', empty'}${isSelected ? ', selected' : ''}${mergeLabel ? `, merged ${mergeLabel}` : ''}`}
      aria-pressed={isSelected}
    >
      {mergeLabel && (
        <span className="abby-patch__cell-merge-label" aria-hidden="true">
          {mergeLabel}
        </span>
      )}
      {isSelected && <span className="abby-patch__cell-selection-mark" aria-hidden="true" />}
    </button>
  );
}

export default memo(GridCell);
