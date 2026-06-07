const SESSION_KEY = 'abbyPatchSession';

export function savePatternSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadAndClearPatternSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
