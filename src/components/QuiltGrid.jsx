import { memo, useMemo } from 'react';
import { isInRepeatRegion } from '../gridUtils';
import GridCell from './GridCell';

function QuiltGrid({
  rows,
  columns,
  cellColors,
  repeatWidth,
  repeatHeight,
  suppressRepeatHighlight,
  eraserMode,
  sideLabel,
  onCellClick,
}) {
  const cellCount = rows * columns;

  const gridStyle = useMemo(
    () => ({
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
    }),
    [rows, columns]
  );

  const repeatRegionFlags = useMemo(() => {
    if (suppressRepeatHighlight) {
      return null;
    }
    const flags = new Array(cellCount);
    for (let i = 0; i < cellCount; i += 1) {
      flags[i] = isInRepeatRegion(i, columns, repeatWidth, repeatHeight);
    }
    return flags;
  }, [cellCount, columns, repeatWidth, repeatHeight, suppressRepeatHighlight]);

  const gridClassName = [
    'abby-patch__grid',
    eraserMode ? 'abby-patch__grid--eraser' : '',
    suppressRepeatHighlight ? 'abby-patch__grid--exporting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={gridClassName} style={gridStyle}>
      {cellColors.map((color, index) => (
        <GridCell
          key={index}
          index={index}
          color={color}
          inRepeatRegion={repeatRegionFlags ? repeatRegionFlags[index] : false}
          sideLabel={sideLabel}
          onCellClick={onCellClick}
        />
      ))}
    </div>
  );
}

export default memo(QuiltGrid);
