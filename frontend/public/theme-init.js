// Apply the theme before first paint (keep in sync with src/app/theme/theme.ts).
// A separate file so the production Content-Security-Policy can stay script-src 'self'.
;(function () {
  var stored = null
  try {
    stored = localStorage.getItem('bloodmap-theme')
  } catch {
    // Storage blocked (private mode): fall back to the system theme.
  }
  var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
})()
