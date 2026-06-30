const USER_EMAIL_KEY = 'useremail';
const HAS_SUBSCRIPTION_KEY = 'has_subscription';
const HAS_USED_FREE_COOKIE = 'has_used_free';

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked in private browsing or strict privacy modes.
  }
}

function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setCookie(name, value, days = 365) {
  try {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // Cookie storage may be blocked.
  }
}

export function getUserEmail() {
  return readLocalStorage(USER_EMAIL_KEY) || '';
}

export function setUserEmail(email) {
  writeLocalStorage(USER_EMAIL_KEY, email.trim());
}

export function hasUsedFree() {
  return getCookie(HAS_USED_FREE_COOKIE) === 'true';
}

export function setHasUsedFree() {
  setCookie(HAS_USED_FREE_COOKIE, 'true');
}

export function hasSubscription() {
  return readLocalStorage(HAS_SUBSCRIPTION_KEY) === 'true';
}

export function setHasSubscription(value) {
  writeLocalStorage(HAS_SUBSCRIPTION_KEY, value ? 'true' : 'false');
}
