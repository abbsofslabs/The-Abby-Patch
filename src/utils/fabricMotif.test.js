import { getFabricPreviewStyle, getFabricTileStyle, fabricHasMotifTile } from './fabricMotif';

describe('fabricMotif tiling', () => {
  const fabric = {
    imageUrl: 'https://example.com/motif.jpg',
    motifWidthIn: 6,
    motifHeightIn: 6,
    primaryColor: '#aa0000',
  };

  test('full motif fills a matching block size', () => {
    const style = getFabricTileStyle(fabric, 6, 0, 0);
    expect(style.backgroundSize).toBe('100% 100%');
    expect(style.backgroundPosition).toBe('0% 0%');
  });

  test('smaller quilt cell shows top-left crop of a larger motif', () => {
    const style = getFabricTileStyle(fabric, 1, 0, 0);
    expect(style.backgroundSize).toBe('600% 600%');
    expect(style.backgroundPosition).toBe('0% 0%');
  });

  test('adjacent cells continue the tile phase for a 12″ area of 6″ motifs', () => {
    const left = getFabricTileStyle(fabric, 6, 0, 0);
    const right = getFabricTileStyle(fabric, 6, 1, 0);
    expect(left.backgroundSize).toBe('100% 100%');
    expect(right.backgroundSize).toBe('100% 100%');
    // Second 6″ cell starts a new full tile (12″ / 6″ = two repeats).
    expect(right.backgroundPosition).toBe('0% 0%');
  });

  test('falls back when motif size is missing', () => {
    expect(getFabricTileStyle({ imageUrl: 'x', primaryColor: '#000' }, 6, 0, 0)).toBeNull();
    expect(fabricHasMotifTile({ imageUrl: 'x', motifWidthIn: 6 })).toBe(false);
    expect(fabricHasMotifTile(fabric)).toBe(true);
  });

  test('12″ preview sizes tiles from motif inches', () => {
    const style = getFabricPreviewStyle(fabric, 12);
    expect(style.backgroundSize).toBe('50% 50%');
  });
});
