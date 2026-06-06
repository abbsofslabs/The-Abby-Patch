export function clampRepeatSize(value, max) {
  return Math.max(1, Math.min(max, Number(value) || 1));
}

export function applyTilePattern(cellColors, rows, columns, repeatWidth, repeatHeight) {
  const rw = clampRepeatSize(repeatWidth, columns);
  const rh = clampRepeatSize(repeatHeight, rows);

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const srcRow = row % rh;
    const srcCol = col % rw;
    const srcIndex = srcRow * columns + srcCol;
    return cellColors[srcIndex] ?? null;
  });
}

export function isInRepeatRegion(index, columns, repeatWidth, repeatHeight) {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return row < repeatHeight && col < repeatWidth;
}
