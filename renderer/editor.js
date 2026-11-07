import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { initZosLanguage, preloadDocumentLanguages } from './zos-language.js';

import {
  updateCursor,
  updateEncoding,
  updateLineEnding,
  updateLanguage,
} from './ui/status-bar.js';

// Extremely lightweight offline worker setup:
// Only editor.worker is included. No heavy TS/JSON/CSS/HTML language servers.
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

window.monaco = monaco;


export class ZosEditor {
  constructor(containerElement, onContentChangeCallback = null, onFileChangedCallback = null) {
    this.container = containerElement;
    this.onContentChangeCallback = onContentChangeCallback;
    this.onFileChangedCallback = onFileChangedCallback;

    // Document state
    this.filePath = null;
    this.fileName = 'Untitled';
    this.isDirty = false;
    this.hasBom = false;
    this.lineEndings = 'LF';
    this.fontSize = 14;
    this.wordWrap = 'on';

    // Initialize Monaco instance
    this.editor = monaco.editor.create(this.container, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      wordWrap: this.wordWrap,
      lineNumbers: 'on',
      minimap: { enabled: false },
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'Segoe UI', 'Cairo', 'Tahoma', monospace",
      fontSize: this.fontSize,
      lineHeight: 22,
      unicodeHighlight: { ambiguousCharacters: false },
      contextmenu: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
    });

    this.bindEvents();
    this.updateTitle();
    updateCursor(1, 1);
    updateEncoding('UTF-8');
    updateLineEnding('LF');
    updateLanguage('plaintext');
  }

  bindEvents() {
    // Track cursor and selection changes
    this.editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      const selection = this.editor.getSelection();
      const selectionLength = selection && !selection.isEmpty()
        ? this.editor.getModel().getValueInRange(selection).length
        : 0;
      updateCursor(position.lineNumber, position.column, selectionLength);
    });

    // Track content edits
    this.editor.onDidChangeModelContent(() => {
      if (!this.isDirty) {
        this.isDirty = true;
        this.updateTitle();
      }
      const val = this.editor.getValue();
      if (this.isZosFile(this.filePath)) {
        preloadDocumentLanguages(val);
      }
      if (this.onContentChangeCallback) {
        this.onContentChangeCallback(val, this);
      }
    });
  }

  updateTitle() {
    const dirtyMarker = this.isDirty ? '*' : '';
    const title = `${dirtyMarker}${this.fileName} - Zos Pad`;
    if (window.zosApi?.setTitle) {
      window.zosApi.setTitle(title);
    } else {
      document.title = title;
    }
  }

  isZosFile(pathOrName) {
    if (!pathOrName) return false;
    return pathOrName.toLowerCase().endsWith('.zos');
  }

  isMarkdownFile(pathOrName) {
    if (!pathOrName) return false;
    const lower = pathOrName.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown');
  }

  async setLanguageForFile(filePath) {
    const model = this.editor.getModel();
    if (!model) return;

    // Strict rule: ONLY .zos files get syntax highlighting ('zos').
    // All other files ALWAYS use 'plaintext'.
    if (this.isZosFile(filePath)) {
      await initZosLanguage();
      const content = this.editor.getValue();
      await preloadDocumentLanguages(content);
      monaco.editor.setModelLanguage(model, 'zos');
      updateLanguage('zos');
    } else {
      monaco.editor.setModelLanguage(model, 'plaintext');
      updateLanguage('plaintext');
    }
  }

  async confirmUnsavedChanges() {
    if (!this.isDirty) return true;

    if (!window.zosApi?.promptUnsavedChanges) return true;

    const action = await window.zosApi.promptUnsavedChanges(this.fileName);
    if (action === 'save') {
      return await this.saveFile(false);
    }
    if (action === 'dont-save') {
      return true;
    }
    return false; // 'cancel'
  }

  async newFile() {
    const canProceed = await this.confirmUnsavedChanges();
    if (!canProceed) return false;

    this.filePath = null;
    this.fileName = 'Untitled';
    this.isDirty = false;
    this.hasBom = false;
    this.lineEndings = 'LF';

    this.editor.setValue('');
    await this.setLanguageForFile(null);
    this.updateTitle();
    updateEncoding('UTF-8');
    updateLineEnding('LF');
    updateCursor(1, 1);

    if (this.onContentChangeCallback) {
      this.onContentChangeCallback('', this);
    }
    if (this.onFileChangedCallback) {
      this.onFileChangedCallback(this);
    }
    return true;
  }

  async openFile(filePath = null) {
    const canProceed = await this.confirmUnsavedChanges();
    if (!canProceed) return false;

    let targetPath = filePath;
    if (!targetPath) {
      targetPath = await window.zosApi.showOpenDialog();
      if (!targetPath) return false;
    }

    const res = await window.zosApi.readFile(targetPath);
    if (!res.success) {
      alert(`Could not open file: ${res.error}`);
      return false;
    }

    this.filePath = res.filePath;
    this.fileName = res.fileName;
    this.hasBom = res.hasBom;
    this.lineEndings = res.lineEndings;
    this.isDirty = false;

    this.editor.setValue(res.content);
    await this.setLanguageForFile(res.filePath);
    this.updateTitle();

    updateEncoding(res.encoding);
    updateLineEnding(res.lineEndings);
    updateCursor(1, 1);

    if (this.onContentChangeCallback) {
      this.onContentChangeCallback(res.content, this);
    }
    if (this.onFileChangedCallback) {
      this.onFileChangedCallback(this);
    }
    return true;
  }

  async saveFile(saveAs = false) {
    let targetPath = this.filePath;

    if (!targetPath || saveAs) {
      const defaultName = this.filePath ? this.fileName : 'Untitled.txt';
      targetPath = await window.zosApi.showSaveDialog(defaultName);
      if (!targetPath) return false;
    }

    const content = this.editor.getValue();
    const res = await window.zosApi.writeFile(targetPath, content, {
      hasBom: this.hasBom,
      lineEndings: this.lineEndings,
    });

    if (!res.success) {
      alert(`Could not save file: ${res.error}`);
      return false;
    }

    this.filePath = res.filePath;
    this.fileName = res.fileName;
    this.isDirty = false;

    // Refresh language mode in case extension was changed during Save As
    await this.setLanguageForFile(this.filePath);
    this.updateTitle();
    if (this.onFileChangedCallback) {
      this.onFileChangedCallback(this);
    }
    return true;
  }

  // Editing Commands
  undo() {
    this.editor.trigger('menu', 'undo', null);
  }

  redo() {
    this.editor.trigger('menu', 'redo', null);
  }

  find() {
    const action = this.editor.getAction('actions.find');
    if (action) action.run();
  }

  replace() {
    const action = this.editor.getAction('editor.action.startFindReplaceAction');
    if (action) action.run();
  }

  toggleWordWrap() {
    this.wordWrap = this.wordWrap === 'on' ? 'off' : 'on';
    this.editor.updateOptions({ wordWrap: this.wordWrap });
    window.zosApi?.saveSettings?.({ wordWrap: this.wordWrap });
  }

  zoomIn() {
    this.fontSize = Math.min(40, this.fontSize + 2);
    this.editor.updateOptions({ fontSize: this.fontSize, lineHeight: this.fontSize * 1.5 });
    window.zosApi?.saveSettings?.({ fontSize: this.fontSize });
  }

  zoomOut() {
    this.fontSize = Math.max(8, this.fontSize - 2);
    this.editor.updateOptions({ fontSize: this.fontSize, lineHeight: this.fontSize * 1.5 });
    window.zosApi?.saveSettings?.({ fontSize: this.fontSize });
  }

  resetZoom() {
    this.fontSize = 14;
    this.editor.updateOptions({ fontSize: 14, lineHeight: 22 });
    window.zosApi?.saveSettings?.({ fontSize: 14 });
  }

  applyInitialSettings(settings) {
    if (!settings) return;
    if (settings.fontSize) {
      this.fontSize = settings.fontSize;
      this.editor.updateOptions({ fontSize: this.fontSize, lineHeight: this.fontSize * 1.5 });
    }
    if (settings.wordWrap) {
      this.wordWrap = settings.wordWrap;
      this.editor.updateOptions({ wordWrap: this.wordWrap });
    }
  }

  focus() {
    this.editor.focus();
  }
}
