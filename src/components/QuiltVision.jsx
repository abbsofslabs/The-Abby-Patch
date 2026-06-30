import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FABRIC_PALETTE } from '../constants';
import QuiltVisionProgress from './QuiltVisionProgress';
import { loadImageFromFile } from '../quiltVision/canvasUtils';
import {
  drawBoundaryOverlay,
  extractBoundaries,
  regionAtPoint,
  renderFilledRegions,
} from '../quiltVision/extractBoundaries';
import { autoDetectCorners, outputSizeFromCorners, warpCornersToRect } from '../quiltVision/perspectiveWarp';
import { PROCESSING_STEPS, REFRESH_STEPS } from '../quiltVision/processingSteps';
import { drawCleanSeamLines, extractCleanSeamLines } from '../quiltVision/seamLineCleanup';
import { traceFabricPieces } from '../quiltVision/traceFabricPhoto';

const OUTPUT_SIZE = 720;

async function traceRegions(canvas, sensitivity, autoTune, onProgress) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const traced = await traceFabricPieces(originalImageData, sensitivity, {
    autoTune,
    onProgress,
  });
  onProgress?.('lines');
  const boundaries = extractBoundaries(traced.labels, canvas.width, canvas.height);
  const seamLines = extractCleanSeamLines(boundaries);
  return {
    labels: traced.labels,
    colors: traced.colors,
    boundaries,
    seamLines,
    regionCount: traced.regionCount,
    autoSensitivity: traced.autoSensitivity,
  };
}

function QuiltVision() {
  const stageRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [correctedCanvas, setCorrectedCanvas] = useState(null);
  const [sensitivity, setSensitivity] = useState(58);
  const [labelMap, setLabelMap] = useState(null);
  const [regionColors, setRegionColors] = useState({});
  const [boundaries, setBoundaries] = useState(null);
  const [seamLines, setSeamLines] = useState([]);
  const [autoSensitivity, setAutoSensitivity] = useState(null);
  const [selectedColor, setSelectedColor] = useState(FABRIC_PALETTE[4].hex);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStepId, setActiveStepId] = useState(null);
  const [progressSteps, setProgressSteps] = useState(PROCESSING_STEPS);
  const [error, setError] = useState(null);
  const [regionCount, setRegionCount] = useState(0);
  const [showOutlines, setShowOutlines] = useState(true);
  const resultCanvasRef = useRef(null);

  const displayCanvas = useMemo(() => {
    if (!correctedCanvas || !labelMap) {
      return correctedCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = correctedCanvas.width;
    canvas.height = correctedCanvas.height;
    renderFilledRegions(
      canvas,
      labelMap,
      regionColors,
      correctedCanvas.width,
      correctedCanvas.height
    );
    if (showOutlines && boundaries) {
      const ctx = canvas.getContext('2d');
      if (seamLines.length) {
        drawCleanSeamLines(ctx, seamLines);
      } else {
        drawBoundaryOverlay(ctx, boundaries);
      }
    }
    return canvas;
  }, [boundaries, correctedCanvas, labelMap, regionColors, seamLines, showOutlines]);

  useEffect(() => {
    const node = resultCanvasRef.current;
    if (!node || !displayCanvas || isProcessing) {
      return;
    }
    node.width = displayCanvas.width;
    node.height = displayCanvas.height;
    const ctx = node.getContext('2d');
    ctx.clearRect(0, 0, node.width, node.height);
    ctx.drawImage(displayCanvas, 0, 0);
  }, [displayCanvas, isProcessing]);

  useEffect(() => {
    const node = previewCanvasRef.current;
    if (!node || !correctedCanvas || !isProcessing) {
      return;
    }
    node.width = correctedCanvas.width;
    node.height = correctedCanvas.height;
    const ctx = node.getContext('2d');
    ctx.clearRect(0, 0, node.width, node.height);
    ctx.drawImage(correctedCanvas, 0, 0);
  }, [correctedCanvas, isProcessing]);

  const applyTraceResult = useCallback((result) => {
    setLabelMap(result.labels);
    setRegionColors(result.colors);
    setBoundaries(result.boundaries);
    setSeamLines(result.seamLines ?? []);
    setRegionCount(result.regionCount);
    if (result.autoSensitivity != null) {
      setAutoSensitivity(result.autoSensitivity);
      setSensitivity(result.autoSensitivity);
    }
  }, []);

  const processPhoto = useCallback(
    async (image) => {
      setActiveStepId('read');
      await new Promise((resolve) => requestAnimationFrame(resolve));

      setActiveStepId('straighten');
      const corners = autoDetectCorners(image);
      const { width, height } = outputSizeFromCorners(corners, OUTPUT_SIZE);
      const canvas = warpCornersToRect(image, corners, width, height);
      setCorrectedCanvas(canvas);

      const result = await traceRegions(canvas, sensitivity, true, setActiveStepId);
      setActiveStepId('done');
      applyTraceResult(result);
      setError(null);
    },
    [applyTraceResult, sensitivity]
  );

  const handleFileChange = async (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setCorrectedCanvas(null);
    setLabelMap(null);
    setRegionColors({});
    setBoundaries(null);
    setSeamLines([]);
    setAutoSensitivity(null);
    setRegionCount(0);
    setError(null);
    setProgressSteps(PROCESSING_STEPS);

    if (!nextFile) {
      return;
    }

    setIsProcessing(true);
    setActiveStepId('read');
    try {
      const image = await loadImageFromFile(nextFile);
      await processPhoto(image);
    } catch (loadError) {
      setError(loadError.message || 'Could not read that photo. Try another one.');
      setCorrectedCanvas(null);
    } finally {
      setIsProcessing(false);
      setActiveStepId(null);
    }
  };

  const handleRefreshOutline = async () => {
    if (!correctedCanvas) {
      return;
    }

    setIsProcessing(true);
    setProgressSteps(REFRESH_STEPS);
    setActiveStepId('pieces');
    setError(null);
    try {
      const result = await traceRegions(correctedCanvas, sensitivity, false, setActiveStepId);
      setActiveStepId('done');
      applyTraceResult(result);
    } catch (traceError) {
      setError(traceError.message || 'Could not update the outline.');
    } finally {
      setIsProcessing(false);
      setActiveStepId(null);
      setProgressSteps(PROCESSING_STEPS);
    }
  };

  const handleCanvasClick = (event) => {
    if (!labelMap || !correctedCanvas) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = correctedCanvas.width / rect.width;
    const scaleY = correctedCanvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const region = regionAtPoint(labelMap, correctedCanvas.width, x, y);
    if (region < 0) {
      return;
    }
    setRegionColors((prev) => ({ ...prev, [region]: selectedColor }));
  };

  return (
    <div className="qv" ref={stageRef}>
      <section className="qv-panel abby-patch__panel">
        <h2 className="abby-patch__section-title">1. Choose your quilt photo</h2>
        <p className="qv-desc">
          Pick a clear photo of the quilt top. We straighten it, find the sewn pieces (not the
          print on the fabric), and trace them for you automatically.
        </p>
        <label className="abby-patch__file-input-label">
          <span className="abby-patch__button abby-patch__button--file">Choose photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="abby-patch__file-input"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </label>
        {file && <p className="qv-file-name">{file.name}</p>}
      </section>

      {isProcessing && (
        <>
          <QuiltVisionProgress
            steps={progressSteps}
            activeStepId={activeStepId}
            title="We're working on your quilt"
            reassurance="Step 4 is the heaviest part — usually 15–30 seconds total. You'll see each step move along."
          />
          {correctedCanvas && (
            <div className="qv-preview-wrap">
              <p className="qv-preview-caption">Your straightened quilt so far</p>
              <canvas ref={previewCanvasRef} className="qv-preview-canvas" />
            </div>
          )}
        </>
      )}

      {correctedCanvas && !isProcessing && (
        <section className="qv-panel abby-patch__panel">
          <h2 className="abby-patch__section-title">2. Plan your fabrics</h2>
          {regionCount > 0 && (
            <p className="qv-desc">
              {regionCount} piece{regionCount === 1 ? '' : 's'} found. Tap a piece to try a new
              fabric color.
              {autoSensitivity != null && (
                <>
                  {' '}
                  We auto-picked detail level {autoSensitivity} for this photo.
                </>
              )}
            </p>
          )}

          <div className="qv-palette" role="listbox" aria-label="Fabric colors">
            {FABRIC_PALETTE.map(({ name, hex, light }) => (
              <button
                key={hex}
                type="button"
                className={`qv-swatch ${selectedColor === hex ? 'qv-swatch--active' : ''}`}
                style={{ backgroundColor: hex }}
                title={name}
                aria-label={name}
                onClick={() => setSelectedColor(hex)}
              >
                {light && <span className="qv-swatch-ring" />}
              </button>
            ))}
          </div>

          <label className="qv-toggle">
            <input
              type="checkbox"
              checked={showOutlines}
              onChange={(event) => setShowOutlines(event.target.checked)}
            />
            Show seam outlines
          </label>

          <button
            type="button"
            className="qv-result-canvas"
            onClick={handleCanvasClick}
            aria-label="Tap quilt pieces to recolor"
          >
            <canvas ref={resultCanvasRef} className="qv-result-canvas-el" />
          </button>

          <details className="qv-advanced">
            <summary className="qv-advanced-summary">Adjust outline</summary>
            <div className="qv-advanced-body">
              <label className="qv-slider-label">
                Ignore fabric prints: {sensitivity}
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={sensitivity}
                  onChange={(event) => setSensitivity(Number(event.target.value))}
                  className="qv-slider"
                />
                <span className="qv-slider-hint">
                  Higher treats busy florals and dots as one piece. Lower splits more seams.
                </span>
              </label>
              <button
                type="button"
                className="abby-patch__tool-button"
                onClick={handleRefreshOutline}
                disabled={isProcessing}
              >
                Update outline
              </button>
            </div>
          </details>
        </section>
      )}

      {error && <p className="abby-patch__segmentation-error">{error}</p>}
    </div>
  );
}

export default memo(QuiltVision);
