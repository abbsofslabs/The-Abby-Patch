import { getPublicBasePath } from './screenColorPicker';

test('relative PUBLIC_URL does not break the screen color picker path', () => {
  expect(getPublicBasePath('.')).toBe('');
  expect(getPublicBasePath('')).toBe('');
  expect(getPublicBasePath('/quilt')).toBe('/quilt');
  expect(getPublicBasePath('/quilt/')).toBe('/quilt');
});
