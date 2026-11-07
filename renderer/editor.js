import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/editor/editor.all.js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { initZosLanguage, preloadDocumentLanguages } from './zos-language.js';

import {
  updateCursor,
  updateEncoding,
  updateLineEnding,
  updateLanguage,
  showStatusNotification,
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
    this.isSaving = false;

    // Initialize Monaco instance
    this.editor = monaco.editor.create(this.container, {
      value: '',
      language: 'plaintext',
      theme: 'zos-dark',
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
    this.updateWordWrapUI();
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
    this.editor.onDidChangeModelContent(async () => {
      if (!this.isDirty) {
        this.isDirty = true;
        this.updateTitle();
      }
      const val = this.editor.getValue();

      // If document is untitled and contains #zores syntax, auto-switch to zos language mode
      if (!this.filePath && /#zores\/(?:zos|end)/i.test(val)) {
        const model = this.editor.getModel();
        if (model && model.getLanguageId() !== 'zos') {
          await this.setLanguageForFile(null);
        }
      }

      if (this.isZosFile(this.filePath)) {
        await preloadDocumentLanguages(val, this.editor.getModel());
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
    if (pathOrName) {
      return pathOrName.toLowerCase().endsWith('.zos');
    }
    // If untitled (null path), check if content has #zores blocks
    if (this.editor) {
      return /#zores\/(?:zos|end)/i.test(this.editor.getValue());
    }
    return false;
  }

  isMarkdownFile(pathOrName) {
    if (!pathOrName) return false;
    const lower = pathOrName.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown');
  }

  async setLanguageForFile(filePath) {
    const model = this.editor.getModel();
    if (!model) return;

    // Strict rule: ONLY .zos files (or untitled with #zores blocks) get syntax highlighting ('zos').
    // All other files ALWAYS use 'plaintext'.
    if (this.isZosFile(filePath)) {
      await initZosLanguage();
      const content = this.editor.getValue();
      await preloadDocumentLanguages(content, model);
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
    if (this.isSaving) return false;
    this.isSaving = true;

    try {
      let targetPath = this.filePath;

      // If file is not yet saved to disk or user clicked "Save As", prompt for location and name
      if (!targetPath || saveAs) {
        let defaultTarget = 'Untitled.zos';
        if (this.filePath) {
          defaultTarget = this.filePath.toLowerCase().endsWith('.zos')
            ? this.filePath
            : `${this.filePath.replace(/\.[^/\\.]*$/, '')}.zos`;
        }
        targetPath = await window.zosApi.showSaveDialog(defaultTarget);
        if (!targetPath) return false;
      }

      // Strictly enforce .zos extension
      if (!targetPath.toLowerCase().endsWith('.zos')) {
        targetPath = `${targetPath.replace(/\.[^/\\.]*$/, '')}.zos`;
      }

      const content = this.editor.getValue();
      const res = await window.zosApi.writeFile(targetPath, content, {
        hasBom: this.hasBom,
        lineEndings: this.lineEndings,
      });

      if (!res.success) {
        if (window.zosApi?.showErrorBox) {
          await window.zosApi.showErrorBox('Save Error', `Could not save file:\n${res.error}`);
        } else {
          alert(`Could not save file: ${res.error}`);
        }
        return false;
      }

      this.filePath = res.filePath;
      this.fileName = res.fileName;
      this.isDirty = false;

      // Refresh language mode: .zos files strictly receive 'zos' multi-language highlighting
      await this.setLanguageForFile(this.filePath);
      this.updateTitle();
      showStatusNotification(`Saved: ${this.fileName}`);

      if (this.onFileChangedCallback) {
        this.onFileChangedCallback(this);
      }
      return true;
    } catch (err) {
      console.error('[Zos Pad] Save error:', err);
      if (window.zosApi?.showErrorBox) {
        await window.zosApi.showErrorBox('Save Error', `Unexpected error during save:\n${err.message}`);
      }
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  // Editing Commands
  undo() {
    this.editor.trigger('menu', 'undo', null);
  }

  redo() {
    this.editor.trigger('menu', 'redo', null);
  }

  find() {
    this.editor.focus();
    const action = this.editor.getAction('actions.find');
    if (action) {
      action.run();
    } else {
      this.editor.trigger('menu', 'actions.find', null);
    }
  }

  replace() {
    this.editor.focus();
    const action = this.editor.getAction('editor.action.startFindReplaceAction');
    if (action) {
      action.run();
    } else {
      this.editor.trigger('menu', 'editor.action.startFindReplaceAction', null);
    }
  }

  toggleWordWrap() {
    this.wordWrap = this.wordWrap === 'on' ? 'off' : 'on';
    this.editor.updateOptions({ wordWrap: this.wordWrap });
    window.zosApi?.saveSettings?.({ wordWrap: this.wordWrap });
    this.updateWordWrapUI();
  }

  updateWordWrapUI() {
    const wrapSpan = document.querySelector('[data-action="toggle-word-wrap"] span:first-child');
    if (wrapSpan) {
      wrapSpan.textContent = this.wordWrap === 'on' ? '✓ Toggle Word Wrap' : 'Toggle Word Wrap';
    }
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
      this.updateWordWrapUI();
    }
  }

  focus() {
    this.editor.focus();
  }
}
