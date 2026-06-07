export function openScreenColorPickerWindow() {
  const base = window.location.origin + (process.env.PUBLIC_URL || '');
  const url = `${base}/screen-color-picker.html`;
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
