export function getPublicBasePath(publicUrl = process.env.PUBLIC_URL || '') {
  // CRA sets PUBLIC_URL to "." when homepage is relative — treat that as root.
  if (!publicUrl || publicUrl === '.') {
    return '';
  }
  return publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
}

function getScreenColorPickerUrl() {
  return `${window.location.origin}${getPublicBasePath()}/screen-color-picker.html`;
}

/** Prefer the built-in EyeDropper in this window when the browser supports it. */
export async function pickScreenColorInPage() {
  if (typeof window === 'undefined' || !window.EyeDropper) {
    return null;
  }

  const eyeDropper = new window.EyeDropper();
  const result = await eyeDropper.open();
  return typeof result?.sRGBHex === 'string' ? result.sRGBHex : null;
}

export function openScreenColorPickerWindow() {
  const url = getScreenColorPickerUrl();
  const popup = window.open(
    url,
    'abbyPatchColorPicker',
    'width=360,height=320,left=120,top=120'
  );

  if (!popup) {
    window.alert('Please allow pop-ups to pick a color from another window.');
    return null;
  }

  return popup;
}

/**
 * Sample a color from the screen. Uses EyeDropper in-page when available;
 * otherwise opens the helper popup window.
 */
export async function pickScreenColor() {
  try {
    const inPage = await pickScreenColorInPage();
    if (inPage) {
      return inPage;
    }
  } catch (error) {
    // AbortError = user cancelled; anything else falls through to the popup.
    if (error?.name === 'AbortError') {
      return null;
    }
  }

  openScreenColorPickerWindow();
  return null;
}

export function subscribeToScreenColorPicker(callback) {
  const handler = (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    if (event.data?.type === 'abby-patch-color' && typeof event.data.color === 'string') {
      callback(event.data.color);
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
