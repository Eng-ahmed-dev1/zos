/**
 * Searchable Quick-Pick modal for inserting code blocks
 */
import { getAllSupportedLanguages } from '../zos-language.js';

let modalElem = null;
let inputElem = null;
let listElem = null;
let filteredItems = [];
let selectedIndex = 0;
let currentEditorInstance = null;

export function initQuickPick(editorInstance) {
  currentEditorInstance = editorInstance;
  modalElem = document.getElementById('quick-pick-modal');
  inputElem = document.getElementById('quick-pick-input');
  listElem = document.getElementById('quick-pick-list');

  if (!modalElem || !inputElem || !listElem) return;

  inputElem.addEventListener('input', () => {
    filterLanguages(inputElem.value);
  });

  inputElem.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % Math.max(1, filteredItems.length);
      renderList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredItems.length) % Math.max(1, filteredItems.length);
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmSelection();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickPick();
    }
  });

  modalElem.addEventListener('click', (e) => {
    if (e.target === modalElem) {
      closeQuickPick();
    }
  });
}

export function openQuickPick() {
  if (!currentEditorInstance) return;

  // Only enabled for .zos files
  if (!currentEditorInstance.isZosFile(currentEditorInstance.filePath)) {
    return;
  }

  selectedIndex = 0;
  if (inputElem) inputElem.value = '';
  filterLanguages('');

  if (modalElem) {
    modalElem.classList.add('open');
    setTimeout(() => inputElem?.focus(), 50);
  }
}

export function closeQuickPick() {
  if (modalElem) {
    modalElem.classList.remove('open');
  }
  if (currentEditorInstance) {
    currentEditorInstance.focus();
  }
}

function filterLanguages(query) {
  const all = getAllSupportedLanguages();
  const q = query.trim().toLowerCase();

  if (!q) {
    filteredItems = all.slice(0, 30);
  } else {
    filteredItems = all.filter((item) => {
      if (item.id.includes(q)) return true;
      if (item.name.toLowerCase().includes(q)) return true;
      return item.aliases.some((a) => a.toLowerCase().includes(q));
    });
  }

  selectedIndex = 0;
  renderList();
}

function renderList() {
  if (!listElem) return;
  listElem.innerHTML = '';

  if (filteredItems.length === 0) {
    const li = document.createElement('li');
    li.className = 'quick-pick-item';
    li.textContent = 'No matching language found';
    listElem.appendChild(li);
    return;
  }

  filteredItems.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = `quick-pick-item ${index === selectedIndex ? 'selected' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;

    const aliasSpan = document.createElement('span');
    aliasSpan.className = 'alias-tag';
    if (item.aliases.length > 0) {
      aliasSpan.textContent = item.aliases.slice(0, 3).join(', ');
    } else {
      aliasSpan.textContent = item.id;
    }

    li.appendChild(nameSpan);
    li.appendChild(aliasSpan);

    li.addEventListener('click', () => {
      selectedIndex = index;
      confirmSelection();
    });

    listElem.appendChild(li);
  });

  const selectedEl = listElem.children[selectedIndex];
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest' });
  }
}

function confirmSelection() {
  const chosen = filteredItems[selectedIndex];
  if (!chosen || !currentEditorInstance) return;

  const langId = chosen.id;
  const editor = currentEditorInstance.editor;
  const selection = editor.getSelection();

  const insertText = `#zores/zos/${langId}\n\n#zores/end\n`;
  editor.executeEdits('quick-pick', [
    {
      range: selection,
      text: insertText,
      forceMoveMarkers: true,
    },
  ]);

  // Position cursor inside the blank line between the markers
  const startLine = selection.startLineNumber;
  editor.setPosition({
    lineNumber: startLine + 1,
    column: 1,
  });

  closeQuickPick();
}
