const SESSION_KEY = 'abbyPatchSession';

export function savePatternSession(data) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Session storage may be blocked.
  }
}

export function loadAndClearPatternSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
