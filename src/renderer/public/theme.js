// Before first paint: main set nativeTheme.themeSource from Settings, so the media query is the saved theme.
document.documentElement.classList.toggle('dark', matchMedia('(prefers-color-scheme: dark)').matches)
