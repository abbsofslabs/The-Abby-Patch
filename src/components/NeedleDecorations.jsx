import { memo } from 'react';

function NeedleSvg({ threadPath, className, style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 48 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d={threadPath}
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <ellipse cx="24" cy="10" rx="1.6" ry="7.5" fill="currentColor" opacity="0.7" />
      <path d="M24 17.5 L22.5 24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="24" cy="8" r="0.8" fill="var(--cream)" opacity="0.9" />
    </svg>
  );
}

const LEFT_NEEDLES = [
  {
    className: 'abby-patch__needle abby-patch__needle--left-1',
    threadPath: 'M24 18 C 4 52, 44 88, 18 128 C -2 162, 38 198, 24 218',
  },
  {
    className: 'abby-patch__needle abby-patch__needle--left-2',
    threadPath: 'M24 18 C 42 48, 8 82, 30 118 C 48 148, 12 182, 24 212',
  },
  {
    className: 'abby-patch__needle abby-patch__needle--left-3',
    threadPath: 'M24 18 C 14 58, 36 92, 20 132 C 8 168, 32 192, 24 208',
  },
];

const RIGHT_NEEDLES = [
  {
    className: 'abby-patch__needle abby-patch__needle--right-1',
    threadPath: 'M24 18 C 44 56, 6 94, 28 134 C 50 168, 16 196, 24 216',
  },
  {
    className: 'abby-patch__needle abby-patch__needle--right-2',
    threadPath: 'M24 18 C 10 44, 40 78, 22 112 C 6 148, 42 178, 24 204',
  },
  {
    className: 'abby-patch__needle abby-patch__needle--right-3',
    threadPath: 'M24 18 C 38 62, 12 98, 26 138 C 44 172, 18 198, 24 214',
  },
];

function NeedleDecorations() {
  return (
    <div className="abby-patch__needle-field" aria-hidden="true">
      {LEFT_NEEDLES.map((needle) => (
        <NeedleSvg key={needle.className} {...needle} />
      ))}
      {RIGHT_NEEDLES.map((needle) => (
        <NeedleSvg key={needle.className} {...needle} />
      ))}
    </div>
  );
}

export default memo(NeedleDecorations);
