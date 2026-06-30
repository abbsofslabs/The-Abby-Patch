import { pickAutoSensitivity } from './autoSensitivity';
import { buildTraceResult, segmentFabricPieces } from './fabricSegmentation';

function traceOnMainThread(imageData, sensitivity, autoTune, onProgress) {
  let chosenSensitivity = sensitivity;
  if (autoTune) {
    onProgress?.('tuning');
    chosenSensitivity = pickAutoSensitivity(imageData);
  }
  onProgress?.('pieces');
  const { labels } = segmentFabricPieces(imageData, chosenSensitivity);
  return {
    ...buildTraceResult(imageData, labels),
    autoSensitivity: chosenSensitivity,
  };
}

export async function traceFabricPieces(imageData, sensitivity, options = {}) {
  const autoTune = options.autoTune !== false;
  const { onProgress } = options;

  if (typeof Worker === 'undefined') {
    return traceOnMainThread(imageData, sensitivity, autoTune, onProgress);
  }

  try {
    const { traceInWorker } = await import('./traceWorkerClient');
    return await traceInWorker(imageData, sensitivity, autoTune, onProgress);
  } catch {
    return traceOnMainThread(imageData, sensitivity, autoTune, onProgress);
  }
}
