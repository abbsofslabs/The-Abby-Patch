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
  onCellPointerUp,
}) {
  const gridStyle = useMemo(
    () => ({
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      '--grid-cols': columns,
      '--grid-rows': rows,
    }),
    [rows, columns]
  );

  const selectedSet = useMemo(() => new Set(selectedBlocks), [selectedBlocks]);
  const isDense = Math.max(rows, columns) > 24;

  const gridClassName = [
    'abby-patch__grid',
    isDense ? 'abby-patch__grid--dense' : '',
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
          onCellPointerUp={onCellPointerUp}
        />
      ))}
    </div>
  );
}

export default memo(QuiltGrid);
