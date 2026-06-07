import { memo, useMemo } from 'react';
import GridCell from './GridCell';
import { getMergeBorders } from '../mergeUtils';

function QuiltGrid({
  rows,
  columns,
  cellColors,
  merges,
  cellMergeIds,
  selectedBlocks,
  suppressRepeatHighlight,
  eraserMode,
  selectionMode,
  sideLabel,
  onCellPointerDown,
  onCellPointerEnter,
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
          mergeBorders={getMergeBorders(index, columns, merges, cellMergeIds)}
          isSelected={!suppressRepeatHighlight && selectedSet.has(index)}
          sideLabel={sideLabel}
          onCellPointerDown={onCellPointerDown}
          onCellPointerEnter={onCellPointerEnter}
        />
      ))}
    </div>
  );
}

export default memo(QuiltGrid);
