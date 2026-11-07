/**
 * Zos Document Validator
 * Scans line by line to detect unclosed code blocks and orphaned closing markers.
 * Emits yellow warning markers via monaco.editor.setModelMarkers.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import { updateWarnings } from './ui/status-bar.js';

let debounceTimer = null;

export function validateZosDocument(editorInstance, delay = 250) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    runValidation(editorInstance);
  }, delay);
}

function runValidation(editorInstance) {
  if (!editorInstance || !editorInstance.editor) return;

  const model = editorInstance.editor.getModel();
  if (!model) return;

  // Only validate .zos files
  if (!editorInstance.isZosFile(editorInstance.filePath)) {
    monaco.editor.setModelMarkers(model, 'zos-validator', []);
    updateWarnings(0);
    return;
  }

  const lineCount = model.getLineCount();
  const openBlocks = [];
  const markers = [];

  const startRegex = /^#zores\/zos\/([a-zA-Z0-9_+#-]+)\s*$/i;
  const endRegex = /^#zores\/end\s*$/;

  for (let i = 1; i <= lineCount; i++) {
    const lineContent = model.getLineContent(i);

    const startMatch = lineContent.match(startRegex);
    if (startMatch) {
      openBlocks.push({
        line: i,
        lang: startMatch[1],
        length: lineContent.length,
      });
      continue;
    }

    if (endRegex.test(lineContent)) {
      if (openBlocks.length > 0) {
        openBlocks.pop();
      } else {
        // Orphaned end marker
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: 'Closing marker #zores/end without an opening block',
          startLineNumber: i,
          startColumn: 1,
          endLineNumber: i,
          endColumn: lineContent.length + 1,
        });
      }
    }
  }

  // Any remaining open blocks have no closing #zores/end
  for (const unclosed of openBlocks) {
    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: 'This block is open and has no #zores/end to close it',
      startLineNumber: unclosed.line,
      startColumn: 1,
      endLineNumber: unclosed.line,
      endColumn: unclosed.length + 1,
    });
  }

  monaco.editor.setModelMarkers(model, 'zos-validator', markers);

  const unclosedCount = openBlocks.length;
  updateWarnings(unclosedCount, () => {
    // On click status bar warning badge, jump to first warning
    if (markers.length > 0) {
      const first = markers[0];
      editorInstance.editor.revealLineInCenter(first.startLineNumber);
      editorInstance.editor.setPosition({
        lineNumber: first.startLineNumber,
        column: first.startColumn,
      });
      editorInstance.editor.focus();
    }
  });
}
