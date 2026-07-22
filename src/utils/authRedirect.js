/**
 * Where Supabase should send users after they click the email confirmation link.
 *
 * Prefer REACT_APP_SITE_URL in production (set on Vercel) so confirm emails never
 * accidentally use a stale localhost Site URL from the Supabase dashboard alone.
 * Locally, fall back to window.location.origin.
 */
export function getAuthRedirectUrl() {
  const configured = (process.env.REACT_APP_SITE_URL || '').trim().replace(/\/$/, '');
  const origin =
    configured ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  const publicUrl = process.env.PUBLIC_URL || '';
  const normalizedBase =
    !publicUrl || publicUrl === '.'
      ? ''
      : publicUrl.endsWith('/')
        ? publicUrl.slice(0, -1)
        : publicUrl;

  return `${origin}${normalizedBase}/auth`;
}
