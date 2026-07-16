import { buildDesignPayload, designHasColoredBlocks, getDesignPreviewMeta } from './designPayload';

test('buildDesignPayload stores grid, sides, and fabric catalog', () => {
  const payload = buildDesignPayload({
    grid: { rows: 2, columns: 2, blockSize: 6, finishedWidth: 12, finishedHeight: 12 },
    sides: {
      front: { cellColors: ['#ff0000', null, null, null], cellColorsB: [null, null, null, null] },
      back: { cellColors: [null, null, null, null], cellColorsB: [null, null, null, null] },
    },
    quiltWidth: 12,
    quiltHeight: 12,
    blockSize: 6,
    quiltSizePreset: 'custom',
    activeSide: 'front',
    boltWidth: 44,
    seamAllowance: 0.25,
    fabricCatalog: { abc: { id: 'abc', name: 'Cotton' } },
  });

  expect(payload.version).toBe(1);
  expect(payload.grid.rows).toBe(2);
  expect(payload.fabricCatalog.abc.name).toBe('Cotton');
  expect(designHasColoredBlocks(payload)).toBe(true);
  expect(getDesignPreviewMeta(payload).previewColors).toEqual(['#ff0000']);
});

test('designHasColoredBlocks is false when empty', () => {
  expect(
    designHasColoredBlocks({
      sides: {
        front: { cellColors: [null], cellColorsB: [null] },
        back: { cellColors: [null], cellColorsB: [null] },
      },
    })
  ).toBe(false);
});
