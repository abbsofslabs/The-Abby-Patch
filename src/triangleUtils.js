/** @typedef {'a' | 'b'} TriangleHalf */
/** @typedef {'nwse' | 'nesw'} DiagonalDirection */

/**
 * Which triangle half was clicked.
 * nwse (\): a = top-right, b = bottom-left
 * nesw (/): a = top-left, b = bottom-right
 */
export function getTriangleHalf(diagonal, xRatio, yRatio) {
  if (!diagonal) {
    return null;
  }

  const x = Math.min(1, Math.max(0, xRatio));
  const y = Math.min(1, Math.max(0, yRatio));

  if (diagonal === 'nwse') {
    return y < x ? 'a' : 'b';
  }

  return x + y < 1 ? 'a' : 'b';
}

export function getHalfFromPointerEvent(event, diagonal) {
  if (!diagonal) {
    return null;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return 'a';
  }

  const xRatio = (event.clientX - rect.left) / rect.width;
  const yRatio = (event.clientY - rect.top) / rect.height;
  return getTriangleHalf(diagonal, xRatio, yRatio);
}

export function nextDiagonal(current) {
  if (current === 'nwse') {
    return 'nesw';
  }
  if (current === 'nesw') {
    return null;
  }
  return 'nwse';
}
