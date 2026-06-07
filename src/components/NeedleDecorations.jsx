import { memo, useEffect, useRef } from 'react';

const MARGIN = 40;
const LAP_MS = 52000;
const TWIRL_EVERY_MS = 11000;
const TWIRL_DURATION_MS = 1400;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function positionOnBorder(progress, width, height) {
  const innerW = width - MARGIN * 2;
  const innerH = height - MARGIN * 2;
  const perimeter = 2 * (innerW + innerH);
  let distance = ((progress % 1) + 1) % 1 * perimeter;

  if (distance <= innerW) {
    return {
      x: MARGIN + distance,
      y: MARGIN,
      angle: 90,
    };
  }
  distance -= innerW;

  if (distance <= innerH) {
    return {
      x: MARGIN + innerW,
      y: MARGIN + distance,
      angle: 180,
    };
  }
  distance -= innerH;

  if (distance <= innerW) {
    return {
      x: MARGIN + innerW - distance,
      y: MARGIN + innerH,
      angle: 270,
    };
  }
  distance -= innerW;

  return {
    x: MARGIN,
    y: MARGIN + innerH - distance,
    angle: 0,
  };
}

function getTwirlDegrees(now) {
  const cycle = now % TWIRL_EVERY_MS;
  if (cycle >= TWIRL_DURATION_MS) {
    return 0;
  }
  const t = cycle / TWIRL_DURATION_MS;
  return easeInOutCubic(t) * 360;
}

function ThickNeedleSvg() {
  return (
    <svg
      className="abby-patch__needle-svg"
      viewBox="0 0 200 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        className="abby-patch__needle-thread"
        d="M 46 42
           C 38 12, 58 4, 66 24
           M 46 48
           C 18 58, 6 78, 28 72
           C 52 64, 44 42, 72 36
           C 108 26, 142 44, 178 36
           C 196 30, 200 50, 182 58"
      />
      <path
        className="abby-patch__needle-body"
        d="M 44 45
           C 40 38, 42 30, 50 28
           L 138 34
           L 152 45
           L 138 56
           L 50 62
           C 42 60, 40 52, 44 45 Z"
      />
      <ellipse className="abby-patch__needle-eye" cx="50" cy="45" rx="5" ry="9" />
    </svg>
  );
}

function NeedleDecorations() {
  const needleRef = useRef(null);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      return undefined;
    }

    let frameId = 0;

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const progress = elapsed / LAP_MS;
      const { innerWidth, innerHeight } = window;
      const { x, y, angle } = positionOnBorder(progress, innerWidth, innerHeight);
      const wiggle = Math.sin(elapsed * 0.004) * 10;
      const twirl = getTwirlDegrees(elapsed);
      const rotation = angle + wiggle + twirl;

      if (needleRef.current) {
        needleRef.current.style.left = `${x}px`;
        needleRef.current.style.top = `${y}px`;
        needleRef.current.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    const handleResize = () => {
      startRef.current = performance.now();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="abby-patch__needle-field" aria-hidden="true">
      <div ref={needleRef} className="abby-patch__needle-dancer">
        <ThickNeedleSvg />
      </div>
    </div>
  );
}

export default memo(NeedleDecorations);
