import { memo, useCallback } from 'react';
import { CREAM } from '../constants';

function GridCell({ index, color, isSelected, sideLabel, onCellClick }) {
  const handleClick = useCallback(() => {
    onCellClick(index);
  }, [index, onCellClick]);

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
      onClick={handleClick}
      aria-label={`${sideLabel} patch ${index + 1}${color ? `, color ${color}` : ', empty'}${isSelected ? ', selected' : ''}`}
      aria-pressed={isSelected}
    />
  );
}

export default memo(GridCell);
