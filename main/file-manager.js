import fs from 'fs';
import path from 'path';
import electron from 'electron';
const dialog = electron?.dialog || electron;



/**
 * Detects whether buffer starts with UTF-8 BOM (EF BB BF)
 */
function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
}

/**
 * Detects predominant line ending in text (\r\n vs \n)
 */
function detectLineEndings(text) {
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfCount = (text.match(/(?<!\r)\n/g) || []).length;
  return crlfCount > lfCount ? 'CRLF' : 'LF';
}

/**
 * Reads file from disk, detects BOM, normalizes content for editor, and records metadata
 */
export async function readFile(filePath) {
  try {
    const rawBuffer = fs.readFileSync(filePath);
    const hasBom = hasUtf8Bom(rawBuffer);
    
    // Slice off BOM if present so Monaco deals with clean UTF-8
    const contentBuffer = hasBom ? rawBuffer.subarray(3) : rawBuffer;
    const content = contentBuffer.toString('utf-8');
    const lineEndings = detectLineEndings(content);
    
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      fileDir: path.dirname(filePath),
      content,
      hasBom,
      lineEndings,
      encoding: hasBom ? 'UTF-8 with BOM' : 'UTF-8',
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Writes content to file, converting line endings and applying BOM if originally present
 */
export async function writeFile(filePath, content, options = {}) {
  try {
    const { hasBom = false, lineEndings = 'LF' } = options;

    // Normalize line endings to target format
    let normalized = content.replace(/\r\n/g, '\n');
    if (lineEndings === 'CRLF') {
      normalized = normalized.replace(/\n/g, '\r\n');
    }

    const contentBuffer = Buffer.from(normalized, 'utf-8');
    let finalBuffer;

    if (hasBom) {
      const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF]);
      finalBuffer = Buffer.concat([bomBuffer, contentBuffer]);
    } else {
      finalBuffer = contentBuffer;
    }

    fs.writeFileSync(filePath, finalBuffer);

    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      fileDir: path.dirname(filePath),
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Shows Open File dialog
 */
export async function showOpenDialog(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Open File - Zos Pad',
    properties: ['openFile'],
    filters: [
      { name: 'All Files (*.*)', extensions: ['*'] },
      { name: 'Zos Files (*.zos)', extensions: ['zos'] },
      { name: 'Markdown Files (*.md)', extensions: ['md', 'markdown'] },
      { name: 'Text Files (*.txt)', extensions: ['txt'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

/**
 * Shows Save As dialog
 */
export async function showSaveDialog(browserWindow, defaultPath = 'Untitled.txt') {
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save As - Zos Pad',
    defaultPath,
    filters: [
      { name: 'All Files (*.*)', extensions: ['*'] },
      { name: 'Zos Files (*.zos)', extensions: ['zos'] },
      { name: 'Markdown Files (*.md)', extensions: ['md'] },
      { name: 'Text Files (*.txt)', extensions: ['txt'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }
  return result.filePath;
}

/**
 * Prompt user to confirm discarding unsaved changes
 * Returns: 'save' | 'dont-save' | 'cancel'
 */
export async function promptUnsavedChanges(browserWindow, fileName = 'Untitled') {
  const result = await dialog.showMessageBox(browserWindow, {
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Zos Pad',
    message: `Do you want to save changes to ${fileName}?`,
    detail: 'Your changes will be lost if you don\'t save them.',
  });

  if (result.response === 0) return 'save';
  if (result.response === 1) return 'dont-save';
  return 'cancel';
}
