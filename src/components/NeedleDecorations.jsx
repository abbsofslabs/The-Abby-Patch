import { memo } from 'react';

const THREAD = '#5c4638';
const NEEDLE = '#6b5d52';
const THREAD_LIGHT = '#8da080';

function NeedleSvg({ threadPath, needleColor = NEEDLE, threadColor = THREAD }) {
  return (
    <svg viewBox="0 0 56 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d={threadPath}
        stroke={threadColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="28" cy="12" rx="2" ry="9" fill={needleColor} />
      <path d="M28 21 L26 30" stroke={needleColor} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="28" cy="9.5" r="1" fill="#e8e2d6" />
    </svg>
  );
}

const DECORATIONS = [
  {
    id: 'left-1',
    side: 'left',
    top: '10%',
    scale: 1,
    threadPath: 'M28 22 C 6 68, 50 112, 20 162 C 2 204, 44 248, 28 276',
    threadColor: THREAD,
  },
  {
    id: 'left-2',
    side: 'left',
    top: '44%',
    scale: 0.88,
    threadPath: 'M28 22 C 48 58, 10 96, 34 140 C 54 178, 14 218, 28 258',
    threadColor: THREAD_LIGHT,
  },
  {
    id: 'left-3',
    side: 'left',
    top: '72%',
    scale: 0.8,
    threadPath: 'M28 22 C 18 62, 42 100, 24 144 C 10 186, 36 220, 28 248',
    threadColor: THREAD,
  },
  {
    id: 'right-1',
    side: 'right',
    top: '14%',
    scale: 1,
    threadPath: 'M28 22 C 50 64, 8 108, 32 152 C 54 192, 16 232, 28 272',
    threadColor: THREAD_LIGHT,
  },
  {
    id: 'right-2',
    side: 'right',
    top: '48%',
    scale: 0.9,
    threadPath: 'M28 22 C 12 52, 46 88, 26 128 C 8 168, 48 206, 28 246',
    threadColor: THREAD,
  },
  {
    id: 'right-3',
    side: 'right',
    top: '76%',
    scale: 0.82,
    threadPath: 'M28 22 C 44 70, 14 108, 30 150 C 50 188, 20 224, 28 254',
    threadColor: THREAD_LIGHT,
  },
];

function NeedleDecorations() {
  return (
    <div className="abby-patch__needle-field" aria-hidden="true">
      {DECORATIONS.map(({ id, side, top, scale, threadPath, threadColor }) => (
        <div
          key={id}
          className={`abby-patch__needle abby-patch__needle--${side}`}
          style={{
            top,
            transform: `scale(${scale})${side === 'right' ? ' scaleX(-1)' : ''}`,
          }}
        >
          <NeedleSvg threadPath={threadPath} threadColor={threadColor} />
        </div>
      ))}
    </div>
  );
}

export default memo(NeedleDecorations);
