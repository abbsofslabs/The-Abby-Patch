import { memo, useCallback, useRef } from 'react';
import QuiltGrid from './QuiltGrid';

/**
 * Large 1×N strip editor for a border depth cross-section
 * (outside → inside).
 */
function BorderStripEditor({
  label,
  strip,
  selectedColor,
  activeFabricId,
  eraserMode,
  onChange,
}) {
  const paintingRef = useRef(false);

  const paint = useCallback(
    (index, half = null) => {
      onChange((prev) => {
        const nextColors = [...prev.cellColors];
        const nextColorsB = [...prev.cellColorsB];
        const nextFabricIds = [...prev.cellFabricIds];
        const nextFabricIdsB = [...prev.cellFabricIdsB];
        const hasDiagonal = Boolean(prev.cellDiagonals[index]);
        const targetHalf = hasDiagonal ? half || 'a' : null;

        if (eraserMode) {
          if (targetHalf === 'b') {
            nextColorsB[index] = null;
            nextFabricIdsB[index] = null;
          } else {
            nextColors[index] = null;
            nextFabricIds[index] = null;
            if (!hasDiagonal) {
              nextColorsB[index] = null;
              nextFabricIdsB[index] = null;
            }
          }
        } else if (selectedColor) {
          if (targetHalf === 'b') {
            nextColorsB[index] = selectedColor;
            nextFabricIdsB[index] = activeFabricId;
          } else {
            nextColors[index] = selectedColor;
            nextFabricIds[index] = activeFabricId;
          }
        }

        return {
          ...prev,
          cellColors: nextColors,
          cellColorsB: nextColorsB,
          cellFabricIds: nextFabricIds,
          cellFabricIdsB: nextFabricIdsB,
        };
      });
    },
    [activeFabricId, eraserMode, onChange, selectedColor]
  );

  const handlePointerDown = useCallback(
    (index, half) => {
      paintingRef.current = true;
      paint(index, half);
    },
    [paint]
  );

  const handlePointerEnter = useCallback(
    (index, half) => {
      if (!paintingRef.current) {
        return;
      }
      paint(index, half);
    },
    [paint]
  );

  const handlePointerUp = useCallback(() => {
    paintingRef.current = false;
  }, []);

  const handleDiagonalToggle = useCallback(
    (index) => {
      onChange((prev) => {
        const nextDiagonals = [...prev.cellDiagonals];
        const nextColorsB = [...prev.cellColorsB];
        const nextFabricIdsB = [...prev.cellFabricIdsB];
        const current = nextDiagonals[index];
        const next =
          current == null ? 'nwse' : current === 'nwse' ? 'nesw' : null;
        nextDiagonals[index] = next;
        if (next) {
          nextColorsB[index] = prev.cellColors[index];
          nextFabricIdsB[index] = prev.cellFabricIds[index];
        } else {
          nextColorsB[index] = null;
          nextFabricIdsB[index] = null;
        }
        return {
          ...prev,
          cellDiagonals: nextDiagonals,
          cellColorsB: nextColorsB,
          cellFabricIdsB: nextFabricIdsB,
        };
      });
    },
    [onChange]
  );

  return (
    <div className="abby-patch__border-strip">
      <h3 className="abby-patch__border-strip-title">{label}</h3>
      <p className="abby-patch__border-strip-hint">
        Left = outer edge of the quilt, right = toward the center. Paint each
        layer, then apply — it fills a {strip.columns}-block-wide frame. Same
        colors merge into one strip; different colors stay separate. Right-click
        a block for a diagonal cut.
      </p>
      <div className="abby-patch__border-strip-editor">
        <div className="abby-patch__border-strip-labels" aria-hidden="true">
          <span>Outside</span>
          <span>Inside</span>
        </div>
        <div className="abby-patch__border-strip-grid">
          <QuiltGrid
            rows={1}
            columns={strip.columns}
            cellColors={strip.cellColors}
            cellColorsB={strip.cellColorsB}
            cellDiagonals={strip.cellDiagonals}
            merges={strip.merges}
            cellMergeIds={strip.cellMergeIds}
            pieceMergeIds={strip.pieceMergeIds}
            selectedBlocks={[]}
            suppressRepeatHighlight
            eraserMode={eraserMode}
            selectionMode={false}
            sideLabel={label}
            onCellPointerDown={handlePointerDown}
            onCellPointerEnter={handlePointerEnter}
            onCellPointerUp={handlePointerUp}
            onCellDiagonalToggle={handleDiagonalToggle}
          />
        </div>
      </div>
    </div>
  );
}

function BorderToolPanel({
  enabled,
  dualBorders,
  topWidth,
  bottomWidth,
  topStrip,
  bottomStrip,
  selectedColor,
  activeFabricId,
  eraserMode,
  hasGrid,
  onToggleEnabled,
  onToggleDual,
  onTopWidthChange,
  onBottomWidthChange,
  onTopStripChange,
  onBottomStripChange,
  onApplyBorder,
  onUnlockBorder,
  borderLocked,
}) {
  return (
    <section className="abby-patch__border-tool abby-patch__panel" aria-label="Border tool">
      <h2 className="abby-patch__section-title">Border tool</h2>
      <p className="abby-patch__tool-box-desc">
        Choose how many blocks wide the border should be (for example 4), paint
        that cross-section, then apply it as a thick frame around the quilt.
        Matching colors merge into one strip automatically; different colors stay
        as separate strips. Once applied, paste-across leaves the border alone.
      </p>

      <label className="abby-patch__border-check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggleEnabled(event.target.checked)}
        />
        Show border editor
      </label>

      {enabled && (
        <>
          <div className="abby-patch__border-widths">
            <div className="abby-patch__input-group">
              <label htmlFor="border-top-width">
                {dualBorders ? 'Top border width (blocks)' : 'Border width (blocks)'}
              </label>
              <input
                id="border-top-width"
                type="number"
                min="1"
                max="24"
                step="1"
                value={topWidth}
                onChange={(event) => onTopWidthChange(Number(event.target.value) || 1)}
              />
            </div>

            {dualBorders && (
              <div className="abby-patch__input-group">
                <label htmlFor="border-bottom-width">Bottom border width (blocks)</label>
                <input
                  id="border-bottom-width"
                  type="number"
                  min="1"
                  max="24"
                  step="1"
                  value={bottomWidth}
                  onChange={(event) => onBottomWidthChange(Number(event.target.value) || 1)}
                />
              </div>
            )}
          </div>

          <label className="abby-patch__border-check">
            <input
              type="checkbox"
              checked={dualBorders}
              onChange={(event) => onToggleDual(event.target.checked)}
            />
            Different top &amp; bottom borders
          </label>

          <BorderStripEditor
            label={
              dualBorders
                ? `Top border (1×${topStrip.columns} deep)`
                : `Border (1×${topStrip.columns} deep)`
            }
            strip={topStrip}
            selectedColor={selectedColor}
            activeFabricId={activeFabricId}
            eraserMode={eraserMode}
            onChange={onTopStripChange}
          />

          {dualBorders && (
            <BorderStripEditor
              label={`Bottom border (1×${bottomStrip.columns} deep)`}
              strip={bottomStrip}
              selectedColor={selectedColor}
              activeFabricId={activeFabricId}
              eraserMode={eraserMode}
              onChange={onBottomStripChange}
            />
          )}

          <div className="abby-patch__border-actions">
            <button
              type="button"
              className="abby-patch__button"
              onClick={onApplyBorder}
              disabled={!hasGrid}
            >
              Apply border to quilt
            </button>
            {borderLocked && (
              <button
                type="button"
                className="abby-patch__tool-button"
                onClick={onUnlockBorder}
              >
                Unlock border (allow paste over it)
              </button>
            )}
          </div>
          {borderLocked && (
            <p className="abby-patch__border-locked-note">
              Border is locked — paste across the quilt will not overwrite the
              border frame.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default memo(BorderToolPanel);
