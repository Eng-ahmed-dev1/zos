/**
 * Zos Language Definition & Monarch Embedding Provider
 *
 * Implements multi-language syntax highlighting inside .zos files:
 * Normal text remains unhighlighted. Code between #zores/zos/<language>
 * and #zores/end is tokenized using the target language's tokens.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/monaco.contribution.js';
import { loadLanguage } from 'monaco-editor/esm/vs/basic-languages/_.contribution.js';

// Custom Language Aliases Map
export const LANGUAGE_ALIASES = {
  // C / C++
  'c++': 'cpp',
  'cpp': 'cpp',
  'c': 'c',
  // C#
  'c#': 'csharp',
  'cs': 'csharp',
  'c-sharp': 'csharp',
  'csharp': 'csharp',
  // JavaScript & TypeScript
  'js': 'javascript',
  'jsx': 'javascript',
  'node': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  // Python
  'py': 'python',
  'python3': 'python',
  'py3': 'python',
  'python': 'python',
  // Shell / Bash
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'terminal': 'shell',
  // PowerShell
  'ps': 'powershell',
  'ps1': 'powershell',
  // Markdown & Markup
  'md': 'markdown',
  'yml': 'yaml',
  'htm': 'html',
  // Go
  'golang': 'go',
  'go': 'go',
  // Rust
  'rs': 'rust',
  'rust': 'rust',
  // Ruby
  'rb': 'ruby',
  // Kotlin
  'kt': 'kotlin',
  'kts': 'kotlin',
  // Dart
  'dart': 'dart',
  'java': 'java',
};

let zosLanguageInitialized = false;
let loadLanguageFn = loadLanguage;
let supportedLanguagesCache = null;

/**
 * Resolves a language string or alias to Monaco's canonical language ID
 */
export function resolveLanguageId(input) {
  if (!input) return null;
  const lower = input.trim().toLowerCase();
  if (LANGUAGE_ALIASES[lower]) {
    return LANGUAGE_ALIASES[lower];
  }
  return lower;
}

/**
 * Escapes special regex characters in alias strings (e.g. c++, c#)
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the list of all supported languages with display names and aliases
 */
export function getAllSupportedLanguages() {
  if (supportedLanguagesCache && supportedLanguagesCache.length > 5) return supportedLanguagesCache;

  const rawLanguages = monaco.languages.getLanguages();
  const langMap = new Map();

  for (const lang of rawLanguages) {
    if (lang.id === 'zos' || lang.id === 'plaintext') continue;

    // Collect all aliases for this language
    const aliases = [];
    if (lang.aliases) {
      for (const a of lang.aliases) {
        if (a && a.toLowerCase() !== lang.id) aliases.push(a.toLowerCase());
      }
    }

    // Add entries from our LANGUAGE_ALIASES table
    for (const [alias, target] of Object.entries(LANGUAGE_ALIASES)) {
      if (target === lang.id && !aliases.includes(alias)) {
        aliases.push(alias);
      }
    }

    langMap.set(lang.id, {
      id: lang.id,
      name: lang.aliases && lang.aliases[0] ? lang.aliases[0] : lang.id,
      aliases,
    });
  }

  const result = Array.from(langMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  if (result.length > 5) {
    supportedLanguagesCache = result;
  }
  return result;
}

/**
 * Initializes the 'zos' language and registers Monarch embedding rules programmatically
 */
import { language as csharpLanguage } from 'monaco-editor/esm/vs/basic-languages/csharp/csharp.js';
import { language as cppLanguage } from 'monaco-editor/esm/vs/basic-languages/cpp/cpp.js';
import { language as dartLanguage } from 'monaco-editor/esm/vs/basic-languages/dart/dart.js';
import { language as javaLanguage } from 'monaco-editor/esm/vs/basic-languages/java/java.js';
import { language as pythonLanguage } from 'monaco-editor/esm/vs/basic-languages/python/python.js';

export async function initZosLanguage() {
  if (zosLanguageInitialized) return;

  loadLanguageFn = loadLanguage;

  // Register 'zos' language
  monaco.languages.register({ id: 'zos', extensions: ['.zos'] });

  // Pre-register and enhance core languages so they tokenize synchronously without chunk delay
  // Enhanced C# Monarch definition: functions yellow, classes teal (both in root and qualified member access)
  const enhancedCsharp = {
    ...csharpLanguage,
    tokenizer: {
      ...csharpLanguage.tokenizer,
      root: [
        [/[a-zA-Z_]\w*(?=\s*\()/, { token: 'function', next: '@qualified' }],
        [/[A-Z]\w*/, { token: 'type.identifier', next: '@qualified' }],
        ...csharpLanguage.tokenizer.root,
      ],
      qualified: [
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[A-Z]\w*/, 'type.identifier'],
        ...csharpLanguage.tokenizer.qualified,
      ],
    },
  };
  monaco.languages.setMonarchTokensProvider('csharp', enhancedCsharp);

  // Enhanced C / C++ Monarch definition: functions yellow, classes/types teal
  const enhancedCpp = {
    ...cppLanguage,
    tokenizer: {
      ...cppLanguage.tokenizer,
      root: [
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[A-Z]\w*/, 'type.identifier'],
        ...cppLanguage.tokenizer.root,
      ],
    },
  };
  monaco.languages.setMonarchTokensProvider('cpp', enhancedCpp);
  monaco.languages.setMonarchTokensProvider('c', enhancedCpp);

  // Enhanced Dart Monarch definition
  const enhancedDart = {
    ...dartLanguage,
    tokenizer: {
      ...dartLanguage.tokenizer,
      root: [
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[A-Z]\w*/, 'type.identifier'],
        ...dartLanguage.tokenizer.root,
      ],
    },
  };
  monaco.languages.setMonarchTokensProvider('dart', enhancedDart);

  // Enhanced Java Monarch definition
  const enhancedJava = {
    ...javaLanguage,
    tokenizer: {
      ...javaLanguage.tokenizer,
      root: [
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[A-Z]\w*/, 'type.identifier'],
        ...javaLanguage.tokenizer.root,
      ],
    },
  };
  monaco.languages.setMonarchTokensProvider('java', enhancedJava);

  // Enhanced Python Monarch definition
  const enhancedPython = {
    ...pythonLanguage,
    tokenizer: {
      ...pythonLanguage.tokenizer,
      root: [
        [/[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[A-Z]\w*/, 'type.identifier'],
        ...pythonLanguage.tokenizer.root,
      ],
    },
  };
  monaco.languages.setMonarchTokensProvider('python', enhancedPython);

  // Programmatically generate Monarch embedding rules
  const supportedLangs = getAllSupportedLanguages();
  const rootRules = [];

  for (const lang of supportedLangs) {
    const patterns = [lang.id, ...lang.aliases].map((a) => escapeRegex(a));
    const combinedPattern = `(?:${patterns.join('|')})`;

    // Match #zores/zos/<language|alias>\s*$
    // Switched to @in_block state with nextEmbedded set to canonical lang.id
    rootRules.push([
      new RegExp(`^#zores/zos/${combinedPattern}\\s*$`, 'i'),
      { token: 'comment.zos', next: '@in_block', nextEmbedded: lang.id },
    ]);
  }

  // Fallback rule for any unspecified language name (renders marker, enters block)
  rootRules.push([
    /^#zores\/zos\/([a-zA-Z0-9_+#-]+)\s*$/i,
    { token: 'comment.zos', next: '@in_block' },
  ]);

  // Match isolated #zores/end in root as gray comment
  rootRules.push([/^#zores\/end\s*$/, 'comment.zos']);

  // Plain text fallback in root
  rootRules.push([/[^#]+/, '']);
  rootRules.push([/./, '']);

  // Set Monarch tokens provider for 'zos'
  monaco.languages.setMonarchTokensProvider('zos', {
    defaultToken: '',
    tokenPostfix: '.zos',
    tokenizer: {
      root: rootRules,
      // Inside embedded code block:
      // When line matches #zores/end\s*$, pop back to root and pop embedded language
      in_block: [
        [/^#zores\/end\s*$/, { token: 'comment.zos', next: '@pop', nextEmbedded: '@pop' }],
      ],
    },
  });

  // Register 'zores' Snippet Completion Provider for both 'zos' and 'plaintext'
  const snippetProvider = {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const langChoiceList = supportedLangs.map((l) => l.id).join(',');
      const snippetString = `#zores/zos/\${1|${langChoiceList}|}\n$0\n#zores/end`;

      return {
        suggestions: [
          {
            label: 'zores',
            kind: monaco.languages.CompletionItemKind.Snippet,
            documentation: 'Insert #zores/zos block with language choice and closing marker',
            insertText: snippetString,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
        ],
      };
    },
  };

  monaco.languages.registerCompletionItemProvider('zos', snippetProvider);
  monaco.languages.registerCompletionItemProvider('plaintext', snippetProvider);

  zosLanguageInitialized = true;
}

const loadedLanguagesSet = new Set(['csharp', 'cpp', 'c', 'dart', 'java', 'python']);

/**
 * Pre-loads tokenizers for languages found inside a .zos document so they highlight instantly
 */
export async function preloadDocumentLanguages(text, editorModel = null) {
  if (!text || !loadLanguageFn) return;

  const matches = text.matchAll(/^#zores\/zos\/([a-zA-Z0-9_+#-]+)\s*$/gim);
  const detected = new Set();
  for (const match of matches) {
    const canonical = resolveLanguageId(match[1]);
    if (canonical) detected.add(canonical);
  }

  let newlyLoaded = false;
  for (const langId of detected) {
    if (!loadedLanguagesSet.has(langId)) {
      try {
        await loadLanguageFn(langId);
        loadedLanguagesSet.add(langId);
        newlyLoaded = true;
      } catch (err) {
        console.warn(`[Zos Pad] Could not pre-load language ${langId}:`, err);
      }
    }
  }

  if (newlyLoaded && editorModel) {
    // Re-set language to flush token cache and re-tokenize with newly loaded language provider
    monaco.editor.setModelLanguage(editorModel, 'zos');
  }
}
