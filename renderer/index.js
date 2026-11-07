/**
 * Main Renderer Entry Point for Zos Pad
 */
import { ZosEditor } from './editor.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { validateZosDocument } from './zos-validator.js';
import { initQuickPick, openQuickPick } from './ui/quick-pick.js';
import {
  initMarkdownPreview,
  togglePreviewMode,
  updateMarkdownButtonVisibility,
  setPreviewActive,
  isMarkdownPreviewActive,
  renderCurrentMarkdown,
} from './markdown-preview.js';

let editorInstance = null;

// Initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('editor-container');

  // Create Editor instance with content change and file change listeners
  editorInstance = new ZosEditor(
    container,
    (content, ed) => {
      // Re-validate unclosed blocks on .zos files
      validateZosDocument(ed);
      // Re-render markdown if preview mode is active
      if (isMarkdownPreviewActive()) {
        renderCurrentMarkdown();
      }
    },
    async (ed) => {
      // Triggered when openFile, newFile, or saveFile completes
      updateMarkdownButtonVisibility(ed);
      validateZosDocument(ed);

      // Markdown files open in Preview mode by default
      if (ed.isMarkdownFile(ed.filePath)) {
        await setPreviewActive(true);
      } else {
        await setPreviewActive(false);
      }
    }
  );
  window.__editor = editorInstance;

  // Initialize interactive components
  initQuickPick(editorInstance);
  initMarkdownPreview(editorInstance);

  // Load user settings
  let settings = null;
  if (window.zosApi?.getSettings) {
    settings = await window.zosApi.getSettings();
  }

  // Apply theme & editor settings
  applyTheme(settings?.theme || 'dark', false);
  if (settings) {
    editorInstance.applyInitialSettings(settings);
  }

  // Wire Top Menubar buttons
  setupMenubar();

  // Wire IPC Menu Actions
  if (window.zosApi?.onMenuAction) {
    window.zosApi.onMenuAction((action) => handleMenuAction(action));
  }

  // Wire file opening from OS (double click or second instance)
  if (window.zosApi?.onOpenFile) {
    window.zosApi.onOpenFile(async (filePath) => {
      await editorInstance.openFile(filePath);
    });
  }

  // Check if a file was passed at initial launch
  if (window.zosApi?.getStartupFile) {
    const startupFile = await window.zosApi.getStartupFile();
    if (startupFile) {
      await editorInstance.openFile(startupFile);
    }
  }

  // Focus editor
  editorInstance.focus();
});

function handleMenuAction(action) {
  if (!editorInstance) return;

  switch (action) {
    case 'new-file':
      editorInstance.newFile();
      break;
    case 'open-file':
      editorInstance.openFile();
      break;
    case 'save-file':
      editorInstance.saveFile(false);
      break;
    case 'save-file-as':
      editorInstance.saveFile(true);
      break;
    case 'undo':
      editorInstance.undo();
      break;
    case 'redo':
      editorInstance.redo();
      break;
    case 'find':
      editorInstance.find();
      break;
    case 'replace':
      editorInstance.replace();
      break;
    case 'toggle-word-wrap':
      editorInstance.toggleWordWrap();
      break;
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'toggle-preview':
      togglePreviewMode();
      break;
    case 'insert-code-block':
      openQuickPick();
      break;
    case 'zoom-in':
      editorInstance.zoomIn();
      break;
    case 'zoom-out':
      editorInstance.zoomOut();
      break;
    case 'zoom-reset':
      editorInstance.resetZoom();
      break;
    case 'about':
      showAboutModal();
      break;
  }
}

function setupMenubar() {
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    toggleTheme();
  });

  document.getElementById('menu-btn-file')?.addEventListener('click', () => {
    editorInstance.openFile();
  });

  document.getElementById('menu-btn-edit')?.addEventListener('click', () => {
    editorInstance.find();
  });

  document.getElementById('menu-btn-view')?.addEventListener('click', () => {
    editorInstance.toggleWordWrap();
  });

  document.getElementById('menu-btn-insert')?.addEventListener('click', () => {
    openQuickPick();
  });

  document.getElementById('menu-btn-help')?.addEventListener('click', () => {
    showAboutModal();
  });

  // About modal close
  document.getElementById('about-close-btn')?.addEventListener('click', () => {
    document.getElementById('about-modal')?.classList.remove('open');
  });

  document.getElementById('about-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'about-modal') {
      e.target.classList.remove('open');
    }
  });

  // Global Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+T: Toggle Theme
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      toggleTheme();
    }
    // Ctrl+Shift+V: Toggle Markdown Preview
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      togglePreviewMode();
    }
    // Ctrl+Alt+Z: Insert Code Block
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      openQuickPick();
    }
  });
}

function showAboutModal() {
  document.getElementById('about-modal')?.classList.add('open');
}
