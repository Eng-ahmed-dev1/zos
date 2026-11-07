/**
 * Theme Manager for Zos Pad
 * Toggles between Dark and Light themes and syncs with Monaco Editor and Markdown preview.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

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

  // Update Monaco Editor theme (using custom zos themes with gray comment styling)
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
