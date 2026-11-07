/**
 * Status Bar Controller for Zos Pad
 */

const cursorElem = document.getElementById('status-cursor');
const encodingElem = document.getElementById('status-encoding');
const lineEndingElem = document.getElementById('status-line-ending');
const languageElem = document.getElementById('status-language');
const warningElem = document.getElementById('status-warning');

let onWarningClickCallback = null;

if (warningElem) {
  warningElem.addEventListener('click', () => {
    if (onWarningClickCallback) onWarningClickCallback();
  });
}

export function updateCursor(line, col, selectionLength = 0) {
  if (!cursorElem) return;
  if (selectionLength > 0) {
    cursorElem.textContent = `Ln ${line}, Col ${col} (${selectionLength} selected)`;
  } else {
    cursorElem.textContent = `Ln ${line}, Col ${col}`;
  }
}

export function updateEncoding(encoding) {
  if (encodingElem) {
    encodingElem.textContent = encoding || 'UTF-8';
  }
}

export function updateLineEnding(lineEnding) {
  if (lineEndingElem) {
    lineEndingElem.textContent = lineEnding || 'LF';
  }
}

export function updateLanguage(lang) {
  if (languageElem) {
    let display = 'Plain Text';
    if (lang === 'zos') display = 'Zos';
    else if (lang === 'markdown') display = 'Markdown';
    else if (lang) display = lang.charAt(0).toUpperCase() + lang.slice(1);
    languageElem.textContent = display;
  }
}

export function updateWarnings(warningCount, onWarningClick = null) {
  onWarningClickCallback = onWarningClick;
  if (!warningElem) return;

  if (warningCount > 0) {
    warningElem.textContent = `⚠️ ${warningCount} unclosed block${warningCount > 1 ? 's' : ''}`;
    warningElem.classList.add('visible');
  } else {
    warningElem.classList.remove('visible');
  }
}

let toastTimeout = null;
export function showStatusNotification(msg, durationMs = 3000) {
  let toast = document.getElementById('status-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'status-toast';
    toast.className = 'status-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, durationMs);
}

