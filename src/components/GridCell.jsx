import { memo, useCallback } from 'react';
import { CREAM } from '../constants';

function GridCell({ index, color, inRepeatRegion, sideLabel, onCellClick }) {
  const handleClick = useCallback(() => {
    onCellClick(index);
  }, [index, onCellClick]);

  const backgroundColor = color || CREAM;
  const className = inRepeatRegion
    ? 'abby-patch__cell abby-patch__cell--repeat-region'
    : 'abby-patch__cell';

  return (
    <button
      type="button"
      className={className}
      style={{ backgroundColor }}
      onClick={handleClick}
      aria-label={`${sideLabel} patch ${index + 1}${color ? `, color ${color}` : ', empty'}${inRepeatRegion ? ', repeat source' : ''}`}
    />
  );
}

export default memo(GridCell);
