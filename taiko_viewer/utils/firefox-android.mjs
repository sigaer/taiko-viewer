// UA detection is shared by the parser-time head script and the client plugin.
export function isFirefoxAndroid(userAgent = "") {
  return /\bAndroid\b/i.test(userAgent) && /\bFirefox\/\d/i.test(userAgent) && !/\b(?:FxiOS|EdgA|OPR)\//i.test(userAgent);
}
export const FIREFOX_ANDROID_BOOTSTRAP = `if ((${isFirefoxAndroid.toString()})(navigator.userAgent)) document.documentElement.classList.add('firefox-android');`;

// Focus alone and toolbar-size changes are not evidence of an on-screen keyboard.
// baselineHeight also covers Gecko configurations that resize the layout viewport.
export function firefoxKeyboardViewport({ innerHeight, height, offsetTop = 0, scale = 1, editable, baselineHeight }) {
  const open = Boolean(editable && Math.abs(scale - 1) < 0.05 && Math.max(innerHeight - height, baselineHeight - height) > 150);
  return { open, inset: open ? Math.max(0, Math.round(innerHeight - height - offsetTop)) : -1 };
}
