import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cropImageToBlob,
  getFabricPreviewStyle,
  sampleImageColor,
} from '../utils/fabricMotif';

/**
 * Store-owner editor: eyedrop primary color, drag a motif rectangle,
 * enter physical repeat size, preview a 12″ tiled square.
 */
export default function FabricMotifEditor({
  imageUrl,
  imageRef,
  primaryColor,
  onPrimaryColorChange,
  cropRect,
  onCropRectChange,
  motifWidthIn,
  motifHeightIn,
  onMotifWidthChange,
  onMotifHeightChange,
  mode,
  onModeChange,
}) {
  const dragRef = useRef(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState('');

  const clientToRatio = useCallback((img, clientX, clientY) => {
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      const img = imageRef?.current;
      if (!img) {
        return;
      }
      event.preventDefault();
      const point = clientToRatio(img, event.clientX, event.clientY);

      if (mode === 'eyedropper') {
        const hex = sampleImageColor(img, event.clientX, event.clientY);
        if (hex) {
          onPrimaryColorChange(hex);
        }
        return;
      }

      dragRef.current = {
        startX: point.x,
        startY: point.y,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onCropRectChange({ x: point.x, y: point.y, w: 0, h: 0 });
    },
    [clientToRatio, imageRef, mode, onCropRectChange, onPrimaryColorChange]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (mode !== 'crop' || !dragRef.current) {
        return;
      }
      const img = imageRef?.current;
      if (!img) {
        return;
      }
      const point = clientToRatio(img, event.clientX, event.clientY);
      const { startX, startY } = dragRef.current;
      const x = Math.min(startX, point.x);
      const y = Math.min(startY, point.y);
      const w = Math.abs(point.x - startX);
      const h = Math.abs(point.y - startY);
      onCropRectChange({ x, y, w, h });
    },
    [clientToRatio, imageRef, mode, onCropRectChange]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const img = imageRef?.current;
    if (!img?.naturalWidth || !cropRect || cropRect.w < 0.01 || cropRect.h < 0.01) {
      setCropPreviewUrl('');
      return undefined;
    }

    cropImageToBlob(img, cropRect, 'image/jpeg', 0.85)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        const url = URL.createObjectURL(blob);
        setCropPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return url;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCropPreviewUrl('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cropRect, imageRef, imageUrl]);

  useEffect(
    () => () => {
      if (cropPreviewUrl) {
        URL.revokeObjectURL(cropPreviewUrl);
      }
    },
    [cropPreviewUrl]
  );

  const tilePreviewStyle = getFabricPreviewStyle({
    imageUrl: cropPreviewUrl || imageUrl,
    motifWidthIn: Number(motifWidthIn) || 6,
    motifHeightIn: Number(motifHeightIn) || 6,
    primaryColor,
  });

  return (
    <div className="abby-patch__motif-editor">
      <div className="abby-patch__motif-toolbar" role="group" aria-label="Fabric photo tools">
        <button
          type="button"
          className={`abby-patch__tool-button ${
            mode === 'eyedropper' ? 'abby-patch__tool-button--active' : ''
          }`}
          onClick={() => onModeChange('eyedropper')}
          aria-pressed={mode === 'eyedropper'}
        >
          Eyedropper color
        </button>
        <button
          type="button"
          className={`abby-patch__tool-button ${
            mode === 'crop' ? 'abby-patch__tool-button--active' : ''
          }`}
          onClick={() => onModeChange('crop')}
          aria-pressed={mode === 'crop'}
        >
          Select print block
        </button>
      </div>

      <p className="abby-patch__motif-hint">
        {mode === 'eyedropper'
          ? 'Click the main color on the photo.'
          : 'Drag a box around one full repeat of the print (the block that tiles).'}
      </p>

      <div
        className={`abby-patch__motif-stage ${
          mode === 'eyedropper' ? 'abby-patch__motif-stage--eyedropper' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Fabric to calibrate"
          className="abby-patch__motif-photo"
          draggable={false}
          crossOrigin="anonymous"
        />
        {mode === 'crop' && cropRect && cropRect.w > 0 && cropRect.h > 0 && (
          <div
            className="abby-patch__motif-crop"
            style={{
              left: `${cropRect.x * 100}%`,
              top: `${cropRect.y * 100}%`,
              width: `${cropRect.w * 100}%`,
              height: `${cropRect.h * 100}%`,
            }}
          />
        )}
      </div>

      <div className="abby-patch__motif-color-row">
        <span
          className="abby-patch__swatch abby-patch__motif-swatch"
          style={{ backgroundColor: primaryColor }}
          aria-hidden="true"
        />
        <span className="abby-patch__legend-hex">{primaryColor.toUpperCase()}</span>
        <span className="abby-patch__motif-color-label">Primary color (cut list)</span>
      </div>

      <div className="abby-patch__motif-sizes">
        <div className="abby-patch__input-group">
          <label htmlFor="motif-width">Print block width (inches)</label>
          <input
            id="motif-width"
            type="number"
            min="0.25"
            step="0.25"
            value={motifWidthIn}
            onChange={(event) => onMotifWidthChange(event.target.value)}
            required
          />
        </div>
        <div className="abby-patch__input-group">
          <label htmlFor="motif-height">Print block height (inches)</label>
          <input
            id="motif-height"
            type="number"
            min="0.25"
            step="0.25"
            value={motifHeightIn}
            onChange={(event) => onMotifHeightChange(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="abby-patch__motif-preview-wrap">
        <h3 className="abby-patch__border-strip-title">12″ preview (how it tiles)</h3>
        <p className="abby-patch__motif-hint">
          A 12-inch square of quilt with your print size — smaller prints repeat more often.
        </p>
        <div
          className="abby-patch__motif-preview"
          style={tilePreviewStyle}
          aria-label="Twelve inch fabric tile preview"
        />
      </div>
    </div>
  );
}
