/* eslint-env worker */
import { pickAutoSensitivity } from './autoSensitivity';
import { buildTraceResult, segmentFabricPieces } from './fabricSegmentation';
import { unpackImageData } from './imageDataUtils';

function reportProgress(id, step) {
  postMessage({ id, type: 'progress', step });
}

onmessage = (event) => {
  const { id, imageData, sensitivity, autoTune } = event.data;

  try {
    const packed = unpackImageData(imageData);
    let chosenSensitivity = sensitivity;

    if (autoTune) {
      reportProgress(id, 'tuning');
      chosenSensitivity = pickAutoSensitivity(packed);
    }

    reportProgress(id, 'pieces');
    const { labels } = segmentFabricPieces(packed, chosenSensitivity);
    const result = buildTraceResult(packed, labels);

    postMessage(
      {
        id,
        type: 'result',
        labels: result.labels.buffer,
        colors: result.colors,
        regionCount: result.regionCount,
        width: result.width,
        height: result.height,
        autoSensitivity: chosenSensitivity,
      },
      [result.labels.buffer]
    );
  } catch (error) {
    postMessage({
      id,
      type: 'result',
      error: error.message || 'Image processing failed.',
    });
  }
};
