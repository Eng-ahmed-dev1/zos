/**
 * Theme Manager for Zos Pad
 * Toggles between Dark and Light themes and syncs with Monaco Editor and Markdown preview.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

// Pre-define themes immediately with rich VS Code-style token coloring rules
monaco.editor.defineTheme('zos-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment.zos', foreground: '808080', fontStyle: 'italic' },
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'member', foreground: 'DCDCAA' },
    { token: 'type.identifier', foreground: '4EC9B0' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'class', foreground: '4EC9B0' },
    { token: 'identifier', foreground: '9CDCFE' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'variable.parameter', foreground: '9CDCFE' },
    { token: 'variable.predefined', foreground: '4EC9B0' },
    { token: 'constant', foreground: '4FC1FF' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'keyword.directive', foreground: 'C586C0' },
    { token: 'keyword.flow', foreground: 'C586C0' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'string.escape', foreground: 'D7BA7D' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'regexp', foreground: 'D16969' },
    { token: 'tag', foreground: '569CD6' },
    { token: 'attribute.name', foreground: '9CDCFE' },
    { token: 'attribute.value', foreground: 'CE9178' },
    { token: 'delimiter', foreground: 'DCDCDC' },
    { token: 'operator', foreground: 'D4D4D4' },
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
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    { token: 'function', foreground: '795E26' },
    { token: 'member', foreground: '795E26' },
    { token: 'type.identifier', foreground: '267F99' },
    { token: 'type', foreground: '267F99' },
    { token: 'class', foreground: '267F99' },
    { token: 'identifier', foreground: '001080' },
    { token: 'variable', foreground: '001080' },
    { token: 'variable.parameter', foreground: '001080' },
    { token: 'variable.predefined', foreground: '267F99' },
    { token: 'constant', foreground: '0070C1' },
    { token: 'keyword', foreground: '0000FF' },
    { token: 'keyword.directive', foreground: 'AF00DB' },
    { token: 'keyword.flow', foreground: 'AF00DB' },
    { token: 'string', foreground: 'A31515' },
    { token: 'string.escape', foreground: 'EE0000' },
    { token: 'number', foreground: '098658' },
    { token: 'regexp', foreground: '811F3F' },
    { token: 'tag', foreground: '800000' },
    { token: 'attribute.name', foreground: 'FF0000' },
    { token: 'attribute.value', foreground: '0451A5' },
    { token: 'delimiter', foreground: '000000' },
    { token: 'operator', foreground: '000000' },
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
