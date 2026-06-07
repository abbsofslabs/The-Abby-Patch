import { memo, useMemo } from 'react';
import GridCell from './GridCell';

function QuiltGrid({
  rows,
  columns,
  cellColors,
  selectedBlocks,
  suppressRepeatHighlight,
  eraserMode,
  selectionMode,
  sideLabel,
  onCellClick,
}) {
  const gridStyle = useMemo(
    () => ({
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
    }),
    [rows, columns]
  );

  const selectedSet = useMemo(() => new Set(selectedBlocks), [selectedBlocks]);

  const gridClassName = [
    'abby-patch__grid',
    eraserMode ? 'abby-patch__grid--eraser' : '',
    selectionMode ? 'abby-patch__grid--selecting' : '',
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
          isSelected={!suppressRepeatHighlight && selectedSet.has(index)}
          sideLabel={sideLabel}
          onCellClick={onCellClick}
        />
      ))}
    </div>
  );
}

export default memo(QuiltGrid);
