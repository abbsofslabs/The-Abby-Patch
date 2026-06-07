import { memo, useCallback } from 'react';
import { CREAM } from '../constants';

function GridCell({
  index,
  color,
  isSelected,
  sideLabel,
  onCellPointerDown,
  onCellPointerEnter,
}) {
  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault();
      onCellPointerDown(index);
    },
    [index, onCellPointerDown]
  );

  const handlePointerEnter = useCallback(() => {
    onCellPointerEnter(index);
  }, [index, onCellPointerEnter]);

  const backgroundColor = color || CREAM;
  const className = [
    'abby-patch__cell',
    isSelected ? 'abby-patch__cell--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      style={{ backgroundColor }}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      aria-label={`${sideLabel} patch ${index + 1}${color ? `, color ${color}` : ', empty'}${isSelected ? ', selected for repeat' : ''}`}
      aria-pressed={isSelected}
    >
      {isSelected && <span className="abby-patch__cell-selection-mark" aria-hidden="true" />}
    </button>
  );
}

export default memo(GridCell);
