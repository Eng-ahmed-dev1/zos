/**
 * Main Renderer Entry Point for Zos Pad
 */
import { ZosEditor } from './editor.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { validateZosDocument } from './zos-validator.js';
import { initQuickPick, openQuickPick } from './ui/quick-pick.js';
import { initZosLanguage } from './zos-language.js';
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
  // Apply default dark theme immediately
  applyTheme('dark', false);

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

  // Initialize interactive UI components immediately
  initQuickPick(editorInstance);
  initMarkdownPreview(editorInstance);
  setupMenubar();

  // Wire IPC Menu Actions immediately
  if (window.zosApi?.onMenuAction) {
    window.zosApi.onMenuAction((action) => handleMenuAction(action));
  }

  // Wire file opening from OS (double click or second instance)
  if (window.zosApi?.onOpenFile) {
    window.zosApi.onOpenFile(async (filePath) => {
      await editorInstance.openFile(filePath);
    });
  }

  // Focus editor
  editorInstance.focus();

  // Pre-initialize Zos multi-language rules early so all tokenizers and themes are ready
  try {
    await initZosLanguage();
  } catch (err) {
    console.warn('[Zos Pad] Error initializing Zos language rules:', err);
  }

  // Load user settings if available
  try {
    if (window.zosApi?.getSettings) {
      const settings = await window.zosApi.getSettings();
      if (settings?.theme) {
        applyTheme(settings.theme, false);
      }
      if (settings) {
        editorInstance.applyInitialSettings(settings);
      }
    }
  } catch (err) {
    console.warn('[Zos Pad] Error loading settings:', err);
  }

  // Check if a file was passed at initial launch
  try {
    if (window.zosApi?.getStartupFile) {
      const startupFile = await window.zosApi.getStartupFile();
      if (startupFile) {
        await editorInstance.openFile(startupFile);
      }
    }
  } catch (err) {
    console.warn('[Zos Pad] Error reading startup file:', err);
  }
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
    case 'exit':
      window.close();
      break;
  }
}

function setupMenubar() {
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    toggleTheme();
  });

  let activeMenu = null;

  function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach((m) => m.classList.remove('open'));
    document.querySelectorAll('.menu-btn').forEach((b) => b.classList.remove('active'));
    activeMenu = null;
  }

  const menuContainers = document.querySelectorAll('.menu-dropdown-container');
  menuContainers.forEach((container) => {
    const btn = container.querySelector('.menu-btn');
    const dropdown = container.querySelector('.dropdown-menu');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      closeAllMenus();
      if (!isOpen) {
        dropdown.classList.add('open');
        btn.classList.add('active');
        activeMenu = dropdown;
      }
    });

    btn.addEventListener('mouseenter', () => {
      if (activeMenu && activeMenu !== dropdown) {
        closeAllMenus();
        dropdown.classList.add('open');
        btn.classList.add('active');
        activeMenu = dropdown;
      }
    });
  });

  // Handle dropdown items click
  document.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.getAttribute('data-action');
      closeAllMenus();
      if (action) {
        handleMenuAction(action);
      }
    });
  });

  // Close menus on clicking outside
  document.addEventListener('click', () => {
    closeAllMenus();
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
    if (e.key === 'Escape') {
      closeAllMenus();
    }
    // Ctrl+N: New File
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      handleMenuAction('new-file');
    }
    // Ctrl+O: Open File
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      handleMenuAction('open-file');
    }
    // Ctrl+S: Save File
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleMenuAction('save-file');
    }
    // Ctrl+Shift+S: Save File As
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleMenuAction('save-file-as');
    }
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
    // Alt+Z: Toggle Word Wrap
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleMenuAction('toggle-word-wrap');
    }
    // Ctrl+Q: Exit
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'q') {
      e.preventDefault();
      handleMenuAction('exit');
    }
    // Ctrl+= / Ctrl++: Zoom In
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      handleMenuAction('zoom-in');
    }
    // Ctrl+-: Zoom Out
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      handleMenuAction('zoom-out');
    }
    // Ctrl+0: Reset Zoom
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      handleMenuAction('zoom-reset');
    }
  });
}

function showAboutModal() {
  document.getElementById('about-modal')?.classList.add('open');
}

