import { memo, useEffect, useMemo, useState } from 'react';
import { segmentUploadedImage } from '../utils/segmentImage';

function SegmentationPanel() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [activeMaskIndex, setActiveMaskIndex] = useState('combined');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const activeMaskUrl = useMemo(() => {
    if (!result) {
      return null;
    }
    if (activeMaskIndex === 'combined') {
      return result.combinedMask;
    }
    return result.individualMasks[activeMaskIndex] ?? null;
  }, [activeMaskIndex, result]);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setError(null);
    setActiveMaskIndex('combined');
  };

  const handleSegment = async () => {
    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await segmentUploadedImage(file);
      setResult(data);
      setActiveMaskIndex('combined');
    } catch (segmentError) {
      setResult(null);
      setError(segmentError.message || 'Unable to segment image.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="abby-patch__segmentation abby-patch__panel" aria-label="Image segmentation">
      <h2 className="abby-patch__section-title">Upload a photo</h2>
      <p className="abby-patch__segmentation-desc">
        Upload a quilt or fabric photo. SAM2 on Replicate will detect regions and return masks you
        can use instead of drawing a grid by hand.
      </p>

      <div className="abby-patch__segmentation-controls">
        <label className="abby-patch__file-input-label">
          <span className="abby-patch__button abby-patch__button--file">Choose image</span>
          <input
            type="file"
            accept="image/*"
            className="abby-patch__file-input"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </label>
        {file && <span className="abby-patch__file-name">{file.name}</span>}
        <button
          type="button"
          className="abby-patch__button"
          onClick={handleSegment}
          disabled={!file || isLoading}
        >
          {isLoading ? 'Segmenting…' : 'Segment with SAM2'}
        </button>
      </div>

      {error && <p className="abby-patch__segmentation-error">{error}</p>}

      {previewUrl && (
        <div className="abby-patch__segmentation-stage">
          <div className="abby-patch__segmentation-image-wrap">
            <img src={previewUrl} alt="Uploaded quilt reference" className="abby-patch__segmentation-image" />
            {activeMaskUrl && (
              <img
                src={activeMaskUrl}
                alt="Segmentation mask overlay"
                className="abby-patch__segmentation-mask"
              />
            )}
          </div>

          {result && (
            <div className="abby-patch__segmentation-masks">
              <p className="abby-patch__segmentation-count">
                {result.maskCount} region{result.maskCount === 1 ? '' : 's'} detected
              </p>
              <div className="abby-patch__segmentation-mask-list" role="tablist" aria-label="Mask layers">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeMaskIndex === 'combined'}
                  className={`abby-patch__mask-tab ${activeMaskIndex === 'combined' ? 'abby-patch__mask-tab--active' : ''}`}
                  onClick={() => setActiveMaskIndex('combined')}
                >
                  Combined
                </button>
                {result.individualMasks.map((maskUrl, index) => (
                  <button
                    key={maskUrl}
                    type="button"
                    role="tab"
                    aria-selected={activeMaskIndex === index}
                    className={`abby-patch__mask-tab ${activeMaskIndex === index ? 'abby-patch__mask-tab--active' : ''}`}
                    onClick={() => setActiveMaskIndex(index)}
                  >
                    Region {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default memo(SegmentationPanel);
