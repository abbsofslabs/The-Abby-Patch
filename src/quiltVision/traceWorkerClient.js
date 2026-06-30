import { pickAutoSensitivity } from './autoSensitivity';
import { buildTraceResult, segmentFabricPieces } from './fabricSegmentation';

let worker;
let requestId = 0;
const pending = new Map();

function getWorker() {
  if (worker) {
    return worker;
  }

  worker = new Worker(new URL('./fabricSegmentation.worker.js', import.meta.url));

  worker.onmessage = (event) => {
    const { id, type } = event.data;
    const handlers = pending.get(id);
    if (!handlers) {
      return;
    }

    if (type === 'progress') {
      handlers.onProgress?.(event.data.step);
      return;
    }

    pending.delete(id);

    if (event.data.error) {
      handlers.reject(new Error(event.data.error));
      return;
    }

    handlers.resolve({
      labels: new Int32Array(event.data.labels),
      colors: event.data.colors,
      regionCount: event.data.regionCount,
      width: event.data.width,
      height: event.data.height,
      autoSensitivity: event.data.autoSensitivity,
    });
  };

  worker.onerror = (event) => {
    pending.forEach(({ reject }) => {
      reject(new Error(event.message || 'Image processing failed.'));
    });
    pending.clear();
    worker = null;
  };

  return worker;
}

export function traceInWorker(imageData, sensitivity, autoTune = true, onProgress) {
  return new Promise((resolve, reject) => {
    const id = requestId + 1;
    requestId = id;
    pending.set(id, { resolve, reject, onProgress });

    getWorker().postMessage({
      id,
      imageData: {
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
      },
      sensitivity,
      autoTune,
    });
  });
}
