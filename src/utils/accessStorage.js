const USER_EMAIL_KEY = 'useremail';
const HAS_SUBSCRIPTION_KEY = 'has_subscription';
const HAS_USED_FREE_COOKIE = 'has_used_free';

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getUserEmail() {
  return localStorage.getItem(USER_EMAIL_KEY) || '';
}

export function setUserEmail(email) {
  localStorage.setItem(USER_EMAIL_KEY, email.trim());
}

export function hasUsedFree() {
  return getCookie(HAS_USED_FREE_COOKIE) === 'true';
}

export function setHasUsedFree() {
  setCookie(HAS_USED_FREE_COOKIE, 'true');
}

export function hasSubscription() {
  return localStorage.getItem(HAS_SUBSCRIPTION_KEY) === 'true';
}

export function setHasSubscription(value) {
  localStorage.setItem(HAS_SUBSCRIPTION_KEY, value ? 'true' : 'false');
}
