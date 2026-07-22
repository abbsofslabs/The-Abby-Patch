import { getAuthRedirectUrl } from './authRedirect';

describe('getAuthRedirectUrl', () => {
  const originalSiteUrl = process.env.REACT_APP_SITE_URL;
  const originalPublicUrl = process.env.PUBLIC_URL;

  afterEach(() => {
    process.env.REACT_APP_SITE_URL = originalSiteUrl;
    process.env.PUBLIC_URL = originalPublicUrl;
  });

  test('uses REACT_APP_SITE_URL when set', () => {
    process.env.REACT_APP_SITE_URL = 'https://theabbypatch.com/';
    process.env.PUBLIC_URL = '.';
    expect(getAuthRedirectUrl()).toBe('https://theabbypatch.com/auth');
  });

  test('falls back to window origin locally', () => {
    delete process.env.REACT_APP_SITE_URL;
    process.env.PUBLIC_URL = '.';
    expect(getAuthRedirectUrl()).toMatch(/\/auth$/);
  });
});
