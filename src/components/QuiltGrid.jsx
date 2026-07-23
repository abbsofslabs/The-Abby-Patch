import { memo, useMemo } from 'react';
import GridCell from './GridCell';
import { getMergeBorders, pieceKey } from '../mergeUtils';

function QuiltGrid({
  rows,
  columns,
  cellColors,
  cellColorsB,
  cellDiagonals,
  cellFabricIds,
  cellFabricIdsB,
  fabricCatalog,
  blockSizeInches,
  merges,
  cellMergeIds,
  pieceMergeIds,
  selectedBlocks,
  suppressRepeatHighlight,
  eraserMode,
  selectionMode,
  sideLabel,
  onCellPointerDown,
  onCellPointerEnter,
  onCellPointerUp,
  onCellDiagonalToggle,
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
  const catalog = fabricCatalog || {};

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
      {cellColors.map((color, index) => {
        const diagonal = cellDiagonals?.[index] ?? null;
        const selectedFull =
          !suppressRepeatHighlight && !diagonal && selectedSet.has(pieceKey(index, null));
        const selectedA =
          !suppressRepeatHighlight && Boolean(diagonal) && selectedSet.has(pieceKey(index, 'a'));
        const selectedB =
          !suppressRepeatHighlight && Boolean(diagonal) && selectedSet.has(pieceKey(index, 'b'));
        const fabricIdA = cellFabricIds?.[index] ?? null;
        const fabricIdB = cellFabricIdsB?.[index] ?? null;

        return (
          <GridCell
            key={index}
            index={index}
            columns={columns}
            color={color}
            colorB={cellColorsB?.[index] ?? null}
            diagonal={diagonal}
            fabricA={fabricIdA ? catalog[fabricIdA] : null}
            fabricB={fabricIdB ? catalog[fabricIdB] : null}
            blockSizeInches={blockSizeInches}
            mergeBorders={getMergeBorders(index, columns, merges, cellMergeIds, {
              rows,
              pieceMergeIds,
              cellDiagonals,
            })}
            selectedFull={selectedFull}
            selectedA={selectedA}
            selectedB={selectedB}
            sideLabel={sideLabel}
            onCellPointerDown={onCellPointerDown}
            onCellPointerEnter={onCellPointerEnter}
            onCellPointerUp={onCellPointerUp}
            onCellDiagonalToggle={onCellDiagonalToggle}
          />
        );
      })}
    </div>
  );
}

export default memo(QuiltGrid);
