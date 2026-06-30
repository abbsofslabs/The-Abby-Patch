function getApiBaseCandidates() {
  const candidates = [];
  const configured = process.env.REACT_APP_CHECKOUT_API_URL?.trim();

  if (configured) {
    candidates.push(configured.replace(/\/$/, ''));
  }

  if (process.env.NODE_ENV === 'development') {
    candidates.push('http://localhost:4242');
    candidates.push('');
  } else if (!configured) {
    candidates.push('');
  }

  return [...new Set(candidates)];
}

async function readErrorMessage(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    const data = JSON.parse(text);
    return data.message || data.error || null;
  } catch {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return null;
    }
    return text.slice(0, 240);
  }
}

async function requestWithApiFallback(path, init) {
  const candidates = getApiBaseCandidates();
  let lastResponse = null;
  let lastNetworkError = null;

  for (const apiBase of candidates) {
    try {
      const response = await fetch(`${apiBase}${path}`, init);

      if (response.status === 405 && candidates.length > 1) {
        lastResponse = response;
        continue;
      }

      return response;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastNetworkError || new Error('Could not reach API server.');
}

export async function segmentUploadedImage(file, options = {}) {
  const formData = new FormData();
  formData.append('image', file);

  if (options.pointsPerSide != null) {
    formData.append('pointsPerSide', String(options.pointsPerSide));
  }
  if (options.predIouThresh != null) {
    formData.append('predIouThresh', String(options.predIouThresh));
  }
  if (options.stabilityScoreThresh != null) {
    formData.append('stabilityScoreThresh', String(options.stabilityScoreThresh));
  }
  if (options.useM2m === false) {
    formData.append('useM2m', 'false');
  }

  let response;
  try {
    response = await requestWithApiFallback('/api/segment-image', {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(
      'Could not reach the segmentation server. Run "npm run dev" so the API server is running on port 4242.'
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `Segmentation failed (HTTP ${response.status}).`);
  }

  return response.json();
}

export async function segmentQuiltBase64(imageDataUri, options = {}) {
  let response;
  try {
    response = await requestWithApiFallback('/api/segment-quilt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageDataUri,
        ...options,
      }),
    });
  } catch {
    throw new Error(
      'Could not reach the segmentation server. Run "npm run dev" so the API server is running on port 4242.'
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `Segmentation failed (HTTP ${response.status}).`);
  }

  return response.json();
}
