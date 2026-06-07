import { memo } from 'react';
import needleThread from '../assets/needle-thread.png';

const DECORATIONS = [
  { id: 'left-1', side: 'left', top: '8%', width: 88, rotate: -12, opacity: 0.28 },
  { id: 'left-2', side: 'left', top: '42%', width: 72, rotate: 8, opacity: 0.22 },
  { id: 'left-3', side: 'left', top: '74%', width: 64, rotate: -18, opacity: 0.2 },
  { id: 'right-1', side: 'right', top: '12%', width: 84, rotate: 14, opacity: 0.26 },
  { id: 'right-2', side: 'right', top: '46%', width: 76, rotate: -6, opacity: 0.22 },
  { id: 'right-3', side: 'right', top: '78%', width: 68, rotate: 16, opacity: 0.2 },
];

function NeedleDecorations() {
  return (
    <div className="abby-patch__needle-field" aria-hidden="true">
      {DECORATIONS.map(({ id, side, top, width, rotate, opacity }) => (
        <img
          key={id}
          src={needleThread}
          alt=""
          className={`abby-patch__needle-art abby-patch__needle-art--${side}`}
          style={{
            top,
            width: `${width}px`,
            transform: `rotate(${rotate}deg)${side === 'right' ? ' scaleX(-1)' : ''}`,
            opacity,
          }}
        />
      ))}
    </div>
  );
}

export default memo(NeedleDecorations);
