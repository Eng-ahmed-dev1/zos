# Zos Pad 📝

**Zos Pad** is a lightweight, standalone, Notepad-style text editor built with Electron and Monaco Editor in pure JavaScript.

It is designed with a strict philosophy:
- **Plain text first**: Opens **ANY** file of **ANY** extension as unhighlighted plain text with zero syntax overhead.
- **Embedded multi-language support**: Exclusively for `.zos` files, code blocks delimited by `#zores/zos/<language>` and `#zores/end` are dynamically syntax-highlighted in that language.
- **Offline GitHub-Style Markdown Preview**: Opens `.md` files in rendered preview mode by default (with Edit one click away), featuring sanitized HTML, highlighted fenced code blocks, and full Arabic/English bidirectional support.
- **Lightweight on RAM and Disk**: Core Monaco editor only (no heavy language servers), lazy tokenizers, lazy markdown parsers, debounced scanners.

---

## The `.zos` File Format

A `.zos` file is plain UTF-8 text. Agenda notes, thoughts, and text remain clean and unhighlighted. Embedded code blocks are delimited by:

```text
Sunday meeting: review architecture and API endpoints
- Ask the engineer about the timeline

#zores/zos/csharp
int x = 42;
Console.WriteLine($"Hello from C# block: {x}");
#zores/end

Notes continue here in plain text.

#zores/zos/python
def calculate_area(width: float, height: float) -> float:
    return width * height

print(calculate_area(10, 20))
#zores/end
```

### Syntax Rules
- Block start: `#zores/zos/<language>` (case-insensitive, supports aliases like `c#`, `c++`, `py`, `js`, `ts`, `sh`, `bash`).
- Block end: `#zores/end`.
- The marker lines themselves render in gray comment styling.
- Unclosed blocks: If a block has no closing `#zores/end`, code continues highlighting until EOF, and a yellow warning marker appears in the editor and status bar.

---

## Features

1. **Notepad-Style Simplicity**: New, Open, Save, Save As, Unsaved Changes prompt, Undo/Redo, Find/Replace, Word Wrap toggle (`Alt+Z`), Zoom in/out (`Ctrl+=` / `Ctrl+-`), and custom status bar.
2. **Multi-Language Support**: All 80+ Monaco bundled languages supported out-of-the-box (C, C++, C#, Dart, Python, JavaScript, TypeScript, Go, Rust, Java, Kotlin, Swift, Shell, PowerShell, SQL, YAML, HTML, CSS, etc.).
3. **Insert Code Block (`Ctrl+Alt+Z`)**: Searchable quick-pick list of all languages with aliases. Select to insert delimiters with cursor positioned inside.
4. **Snippet (`zores` + Tab)**: Type `zores` and press Tab in any `.zos` file to trigger an interactive language dropdown snippet.
5. **Debounced Diagnostics**: Real-time line-by-line validation warning about unclosed `#zores/zos` blocks or orphaned `#zores/end` lines.
6. **GitHub Markdown Preview (`Ctrl+Shift+V`)**: Markdown files open directly in GitHub preview mode with syntax-highlighted code blocks, tables, task lists, and relative image loading over `zos-file://`.
7. **Full Bidirectional (Bidi) Text**: Arabic and English mixed lines render smoothly with proper font fallback (`Cairo`, `Segoe UI`, `Cascadia Code`).
8. **Theme Persistence**: Light and Dark theme toggle (`Ctrl+Shift+T`), remembering window dimensions and preferences across runs.

---

## Development

### Prerequisites
- Node.js (v18 or higher)
- npm

### Run in Development
```bash
# 1. Clone repository
git clone https://github.com/Eng-ahmed-dev1/zos-pad.git
cd zos-pad

# 2. Install dependencies
npm install

# 3. Build renderer and start app
npm start
```

---

## How to Add a Language Alias

To register a new alias for an existing language, open `renderer/zos-language.js` and add an entry to the `LANGUAGE_ALIASES` object:

```javascript
export const LANGUAGE_ALIASES = {
  // Existing aliases...
  'py': 'python',
  'c#': 'csharp',
  
  // Example: Add your new alias here (alias: targetMonacoLanguageId)
  'myalias': 'python',
};
```
Rebuild using `npm run build:renderer`. The new alias will instantly be recognized in `#zores/zos/myalias`, the Quick-Pick modal (`Ctrl+Alt+Z`), and snippets.

---

## Packaging & Installers

Zos Pad builds standalone installers with `.zos` file association:

```bash
# Build production bundle
npm run build:renderer

# Build Linux .deb and .AppImage
npx electron-builder --linux deb AppImage

# Build Windows NSIS installer and Portable executable
npx electron-builder --win nsis portable
```
All outputs are placed in the `release/` directory.

---

## CI/CD and GitHub Releases

This repository includes a GitHub Actions workflow (`.github/workflows/release.yml`).

### How to Trigger a Release
Create and push a git tag starting with `v` (e.g. `v1.0.0`):
```bash
git tag v1.0.0
git push origin v1.0.0
```
GitHub Actions will automatically:
1. Build Linux packages (`.deb` and `.AppImage`).
2. Build Windows packages (`NSIS Setup.exe` and `Portable.exe`).
3. Create a GitHub Release with auto-generated release notes and attach all installer binaries for users to download.

---

## License
MIT License. Built by Eng-ahmed-dev1.
