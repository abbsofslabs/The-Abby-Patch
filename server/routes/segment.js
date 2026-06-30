const express = require('express');
const multer = require('multer');
const { isSegmentationConfigured, segmentImageBuffer } = require('../lib/replicateSam2');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype?.startsWith('image/')) {
      callback(null, true);
      return;
    }
    callback(new Error('Only image uploads are supported.'));
  },
});

function parseBase64Image(body) {
  const raw = body?.image;
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return {
      buffer: Buffer.from(match[2], 'base64'),
      mimeType: match[1],
    };
  }

  return {
    buffer: Buffer.from(raw, 'base64'),
    mimeType: body.mimeType || 'image/jpeg',
  };
}

async function runSegmentation(req, res, buffer, mimeType, sourceMeta = {}) {
  if (!isSegmentationConfigured()) {
    return res.status(500).json({
      message:
        'Image segmentation is not configured. Add REPLICATE_API_TOKEN to .env.local and restart the server.',
    });
  }

  try {
    const result = await segmentImageBuffer(buffer, mimeType, {
      pointsPerSide: req.body.pointsPerSide,
      predIouThresh: req.body.predIouThresh,
      stabilityScoreThresh: req.body.stabilityScoreThresh,
      useM2m: req.body.useM2m !== 'false' && req.body.useM2m !== false,
    });

    return res.json({
      ...result,
      source: sourceMeta,
    });
  } catch (error) {
    console.error('SAM2 segmentation error:', error.message);
    return res.status(500).json({
      message: error.message || 'Unable to segment image.',
    });
  }
}

router.get('/segment-status', (_req, res) => {
  res.json({
    configured: isSegmentationConfigured(),
    model: process.env.REPLICATE_SAM2_MODEL || 'lucataco/segment-anything-2',
  });
});

router.post('/segment-quilt', async (req, res) => {
  const parsed = parseBase64Image(req.body);
  if (!parsed) {
    return res.status(400).json({
      message: 'Send a base64 image in the "image" field (data URI or raw base64).',
    });
  }

  return runSegmentation(req, res, parsed.buffer, parsed.mimeType, {
    encoding: 'base64',
    mimeType: parsed.mimeType,
    size: parsed.buffer.length,
  });
});

router.post('/segment-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Upload an image file in the "image" field.' });
  }

  return runSegmentation(req, res, req.file.buffer, req.file.mimetype, {
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image must be 12 MB or smaller.' });
    }
    return res.status(400).json({ message: error.message });
  }

  if (error?.message) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
});

module.exports = router;
