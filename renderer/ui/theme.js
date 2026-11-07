/**
 * Theme Manager for Zos Pad
 * Toggles between Dark and Light themes and syncs with Monaco Editor and Markdown preview.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

// Pre-define themes immediately so Monaco never defaults to white 'vs'
monaco.editor.defineTheme('zos-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment.zos', foreground: '808080', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
  },
});

monaco.editor.defineTheme('zos-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment.zos', foreground: '707070', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1e1e1e',
  },
});

let currentTheme = 'dark';

export function getTheme() {
  return currentTheme;
}

export function applyTheme(theme, save = true) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const themeIcon = document.getElementById('theme-btn-icon');
  if (themeIcon) {
    themeIcon.textContent = currentTheme === 'light' ? '☀️' : '🌙';
  }

  // Set the pre-defined Monaco Editor theme
  monaco.editor.setTheme(currentTheme === 'light' ? 'zos-light' : 'zos-dark');

  // Update highlight.js theme stylesheet if link exists
  const hljsTheme = document.getElementById('hljs-theme');
  if (hljsTheme) {
    hljsTheme.href = currentTheme === 'light'
      ? './node_modules/highlight.js/styles/github.css'
      : './node_modules/highlight.js/styles/github-dark.css';
  }

  if (save && window.zosApi?.saveSettings) {
    window.zosApi.saveSettings({ theme: currentTheme });
  }
}

export function toggleTheme() {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme, true);
  return nextTheme;
}
