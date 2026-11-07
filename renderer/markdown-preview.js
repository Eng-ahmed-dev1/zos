/**
 * GitHub-Style Markdown Preview Module for Zos Pad
 *
 * Lazily loads marked, DOMPurify, highlight.js/lib/core, and common languages
 * only when a markdown file is first viewed.
 * Local images resolve via custom zos-file:// protocol under strict CSP.
 * Bidirectional Arabic text rendered with dir="auto".
 */

let markedLib = null;
let purifyLib = null;
let hljsLib = null;
let markdownLibsLoaded = false;

let isPreviewActive = false;
let currentEditorInstance = null;

/**
 * Lazily loads marked, DOMPurify, and common highlight.js languages
 */
async function ensureMarkdownLibraries() {
  if (markdownLibsLoaded) return;

  const [{ marked }, { default: DOMPurify }, { default: hljs }] = await Promise.all([
    import('marked'),
    import('dompurify'),
    import('highlight.js/lib/core'),
  ]);

  // Load only common languages into highlight.js to preserve memory and bundle size
  const [
    { default: python },
    { default: csharp },
    { default: dart },
    { default: javascript },
    { default: typescript },
    { default: bash },
    { default: cpp },
    { default: java },
    { default: rust },
    { default: go },
    { default: json },
    { default: yaml },
    { default: css },
    { default: xml },
    { default: sql },
    { default: markdownLang },
  ] = await Promise.all([
    import('highlight.js/lib/languages/python'),
    import('highlight.js/lib/languages/csharp'),
    import('highlight.js/lib/languages/dart'),
    import('highlight.js/lib/languages/javascript'),
    import('highlight.js/lib/languages/typescript'),
    import('highlight.js/lib/languages/bash'),
    import('highlight.js/lib/languages/cpp'),
    import('highlight.js/lib/languages/java'),
    import('highlight.js/lib/languages/rust'),
    import('highlight.js/lib/languages/go'),
    import('highlight.js/lib/languages/json'),
    import('highlight.js/lib/languages/yaml'),
    import('highlight.js/lib/languages/css'),
    import('highlight.js/lib/languages/xml'),
    import('highlight.js/lib/languages/sql'),
    import('highlight.js/lib/languages/markdown'),
  ]);

  hljs.registerLanguage('python', python);
  hljs.registerLanguage('py', python);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('cs', csharp);
  hljs.registerLanguage('dart', dart);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('js', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('ts', typescript);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('sh', bash);
  hljs.registerLanguage('shell', bash);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('c++', cpp);
  hljs.registerLanguage('c', cpp);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('rs', rust);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('golang', go);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('yml', yaml);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('markdown', markdownLang);
  hljs.registerLanguage('md', markdownLang);

  markedLib = marked;
  purifyLib = DOMPurify;
  hljsLib = hljs;

  markdownLibsLoaded = true;
}

/**
 * Resolves relative file or image path against the file's directory
 */
function resolveLocalPath(src, baseDir) {
  if (!src) return src;
  // If remote or data URI, return as-is
  if (/^(https?:|data:|blob:|\/\/)/i.test(src)) {
    return src;
  }
  if (!baseDir) return src;

  // Normalize path
  let cleaned = src.replace(/\\/g, '/');
  let base = baseDir.replace(/\\/g, '/');
  if (!base.endsWith('/')) base += '/';

  // If path is relative
  if (!cleaned.startsWith('/')) {
    cleaned = base + cleaned;
  }

  // Prefix with custom zos-file protocol (which is handled by Electron net.fetch under CSP)
  return `zos-file://${cleaned}`;
}

/**
 * Initializes Markdown Preview controller
 */
export function initMarkdownPreview(editorInstance) {
  currentEditorInstance = editorInstance;

  const toggleBtn = document.getElementById('btn-toggle-preview');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      togglePreviewMode();
    });
  }
}

/**
 * Updates visibility of preview toggle button based on current file extension
 */
export function updateMarkdownButtonVisibility(editorInstance) {
  const toggleBtn = document.getElementById('btn-toggle-preview');
  if (!toggleBtn || !editorInstance) return;

  const isMd = editorInstance.isMarkdownFile(editorInstance.filePath);
  toggleBtn.style.display = isMd ? 'inline-flex' : 'none';

  if (!isMd && isPreviewActive) {
    // If user opened a non-markdown file while in preview mode, switch back to editor
    setPreviewActive(false);
  }
}

/**
 * Toggles between Editor and Preview modes
 */
export async function togglePreviewMode() {
  if (!currentEditorInstance) return;
  if (!currentEditorInstance.isMarkdownFile(currentEditorInstance.filePath)) {
    return;
  }

  await setPreviewActive(!isPreviewActive);
}

/**
 * Sets preview state
 */
export async function setPreviewActive(active) {
  isPreviewActive = active;

  const editorContainer = document.getElementById('editor-container');
  const previewContainer = document.getElementById('preview-container');
  const toggleBtn = document.getElementById('btn-toggle-preview');
  const btnIcon = document.getElementById('preview-btn-icon');
  const btnText = document.getElementById('preview-btn-text');

  if (active) {
    // Render Markdown into preview container
    await renderCurrentMarkdown();

    if (editorContainer) editorContainer.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'block';

    if (toggleBtn) toggleBtn.classList.add('active');
    if (btnIcon) btnIcon.textContent = '✏️';
    if (btnText) btnText.textContent = 'Edit';
  } else {
    if (previewContainer) previewContainer.style.display = 'none';
    if (editorContainer) {
      editorContainer.style.display = 'block';
      currentEditorInstance?.editor?.layout();
      currentEditorInstance?.focus();
    }

    if (toggleBtn) toggleBtn.classList.remove('active');
    if (btnIcon) btnIcon.textContent = '👁️';
    if (btnText) btnText.textContent = 'Preview';
  }
}

export function isMarkdownPreviewActive() {
  return isPreviewActive;
}

/**
 * Renders the editor's markdown content into the preview container
 */
export async function renderCurrentMarkdown() {
  if (!currentEditorInstance) return;

  const previewContainer = document.getElementById('preview-container');
  if (!previewContainer) return;

  await ensureMarkdownLibraries();

  const markdownText = currentEditorInstance.editor.getValue();
  const fileDir = currentEditorInstance.filePath
    ? currentEditorInstance.filePath.substring(0, currentEditorInstance.filePath.lastIndexOf('/'))
    : null;

  // Custom renderer for marked to support highlight.js, zos-file images, and dir="auto"
  const renderer = new markedLib.Renderer();

  // Fenced code blocks with highlight.js
  renderer.code = function ({ text, lang }) {
    const validLang = lang && hljsLib.getLanguage(lang) ? lang : null;
    let highlighted;
    try {
      if (validLang) {
        highlighted = hljsLib.highlight(text, { language: validLang }).value;
      } else {
        highlighted = hljsLib.highlightAuto(text).value;
      }
    } catch {
      highlighted = text;
    }
    return `<pre><code class="hljs ${validLang || ''}">${highlighted}</code></pre>`;
  };

  // Local images resolution under CSP
  renderer.image = function ({ href, title, text }) {
    const resolvedHref = resolveLocalPath(href, fileDir);
    const titleAttr = title ? ` title="${title}"` : '';
    const altAttr = text ? ` alt="${text}"` : '';
    return `<img src="${resolvedHref}"${altAttr}${titleAttr} loading="lazy" />`;
  };

  // Links
  renderer.link = function ({ href, title, text }) {
    const resolvedHref = resolveLocalPath(href, fileDir);
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${resolvedHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  // Set dir="auto" on paragraphs and headings for mixed Arabic and English lines
  renderer.paragraph = function ({ text }) {
    return `<p dir="auto">${text}</p>`;
  };

  renderer.heading = function ({ text, depth }) {
    return `<h${depth} dir="auto">${text}</h${depth}>`;
  };

  renderer.listitem = function ({ text }) {
    return `<li dir="auto">${text}</li>`;
  };

  renderer.blockquote = function ({ text }) {
    return `<blockquote dir="auto">${text}</blockquote>`;
  };

  markedLib.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  const rawHtml = markedLib.parse(markdownText);
  // Sanitize via DOMPurify, allowing zos-file URI scheme
  const sanitized = purifyLib.sanitize(rawHtml, {
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|zos-file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'dir'],
  });

  previewContainer.innerHTML = sanitized;
}
