import { memo } from 'react';

function Flower() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="4" fill="currentColor" />
      <ellipse cx="24" cy="12" rx="6" ry="10" fill="currentColor" opacity="0.55" />
      <ellipse cx="24" cy="36" rx="6" ry="10" fill="currentColor" opacity="0.55" />
      <ellipse cx="12" cy="24" rx="10" ry="6" fill="currentColor" opacity="0.55" />
      <ellipse cx="36" cy="24" rx="10" ry="6" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function FloralDecorations() {
  return (
    <div className="abby-patch__florals" aria-hidden="true">
      <div className="abby-patch__floral abby-patch__floral--tl">
        <Flower />
      </div>
      <div className="abby-patch__floral abby-patch__floral--tr">
        <Flower />
      </div>
      <div className="abby-patch__floral abby-patch__floral--bl">
        <Flower />
      </div>
      <div className="abby-patch__floral abby-patch__floral--br">
        <Flower />
      </div>
    </div>
  );
}

export default memo(FloralDecorations);
