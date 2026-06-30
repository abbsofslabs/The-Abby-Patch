const Replicate = require('replicate');

const SAM2_MODEL =
  process.env.REPLICATE_SAM2_MODEL || 'lucataco/segment-anything-2';

function getReplicateClient() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return null;
  }
  return new Replicate({ auth: token });
}

function isSegmentationConfigured() {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

function bufferToDataUri(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function segmentImageBuffer(buffer, mimeType, options = {}) {
  const replicate = getReplicateClient();
  if (!replicate) {
    throw new Error('REPLICATE_API_TOKEN is not configured on the server.');
  }

  const input = {
    image: bufferToDataUri(buffer, mimeType),
    points_per_side: Number(options.pointsPerSide ?? 32),
    pred_iou_thresh: Number(options.predIouThresh ?? 0.88),
    stability_score_thresh: Number(options.stabilityScoreThresh ?? 0.95),
    use_m2m: options.useM2m !== false,
  };

  const output = await replicate.run(SAM2_MODEL, { input });

  const combinedMask =
    typeof output === 'object' && output !== null ? output.combined_mask : null;
  const individualMasks =
    typeof output === 'object' && output !== null && Array.isArray(output.individual_masks)
      ? output.individual_masks
      : [];

  if (!combinedMask && !individualMasks.length) {
    throw new Error('SAM2 did not return any masks for this image.');
  }

  return {
    combinedMask: combinedMask || null,
    individualMasks,
    maskCount: individualMasks.length,
  };
}

module.exports = {
  isSegmentationConfigured,
  segmentImageBuffer,
};
