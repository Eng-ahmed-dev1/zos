import electron from 'electron';
const { app, BrowserWindow, ipcMain, Menu, protocol, net } = electron;

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import { loadSettings, saveSettings } from './settings.js';
import {
  readFile,
  writeFile,
  showOpenDialog,
  showSaveDialog,
  promptUnsavedChanges,
} from './file-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'zos-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow = null;
let settings = null;
let fileToOpenOnStartup = null;

// Determine if running in Vite dev mode or packaged/built dist
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// Single-Instance Lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // When a second instance is launched (e.g. user double-clicked a file), focus this window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Extract file path from command line arguments
      const filePath = extractFilePathFromArgv(commandLine);
      if (filePath) {
        mainWindow.webContents.send('app:open-file-path', filePath);
      }
    }
  });
}

/**
 * Extracts candidate file path from process.argv
 */
function extractFilePathFromArgv(argv) {
  // Filter out node/electron binaries, electron options, and flags
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const arg of args) {
    if (!arg.startsWith('-') && !arg.startsWith('--')) {
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
      }
    }
  }
  return null;
}

// Check startup argv
fileToOpenOnStartup = extractFilePathFromArgv(process.argv);

// Handle macOS/Linux open-file event
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('app:open-file-path', filePath);
  } else {
    fileToOpenOnStartup = filePath;
  }
});

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:action', 'new-file'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:action', 'open-file'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:action', 'save-file'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:action', 'save-file-as'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu:action', 'undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow?.webContents.send('menu:action', 'redo'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow?.webContents.send('menu:action', 'find'),
        },
        {
          label: 'Replace...',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.webContents.send('menu:action', 'replace'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Word Wrap',
          accelerator: 'Alt+Z',
          click: () => mainWindow?.webContents.send('menu:action', 'toggle-word-wrap'),
        },
        {
          label: 'Toggle Theme (Light / Dark)',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => mainWindow?.webContents.send('menu:action', 'toggle-theme'),
        },
        {
          label: 'Toggle Markdown Preview',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => mainWindow?.webContents.send('menu:action', 'toggle-preview'),
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow?.webContents.send('menu:action', 'zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.send('menu:action', 'zoom-out'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.send('menu:action', 'zoom-reset'),
        },
      ],
    },
    {
      label: 'Insert',
      submenu: [
        {
          label: 'Code Block...',
          accelerator: 'CmdOrCtrl+Alt+Z',
          click: () => mainWindow?.webContents.send('menu:action', 'insert-code-block'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Zos Pad',
          click: () => mainWindow?.webContents.send('menu:action', 'about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  settings = loadSettings();
  const { width, height, x, y, isMaximized } = settings.window;

  mainWindow = new BrowserWindow({
    width: width || 960,
    height: height || 680,
    x,
    y,
    minWidth: 500,
    minHeight: 380,
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Untitled - Zos Pad',
    backgroundColor: settings.theme === 'light' ? '#ffffff' : '#1e1e1e',
    show: false, // Wait until ready-to-show to prevent visual flicker
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Allowed for custom protocol and preload integration
      spellcheck: false,
      devTools: isDev,
    },
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  // Track window bounds on resize/move to persist
  const saveWindowBounds = () => {
    if (!mainWindow) return;
    const isMax = mainWindow.isMaximized();
    if (!isMax) {
      const bounds = mainWindow.getBounds();
      saveSettings({
        window: {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: false,
        },
      });
    } else {
      saveSettings({
        window: {
          ...settings.window,
          isMaximized: true,
        },
      });
    }
  };

  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);

  // Ready to show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close confirmation if dirty
  mainWindow.on('close', (event) => {
    // We let renderer confirm if changes exist
  });

  createApplicationMenu();

  // Load the web app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Register secure custom protocol for resolving local images in Markdown preview
  // Example URI: zos-file:///home/user/notes/diagram.png
  protocol.handle('zos-file', (request) => {
    try {
      const url = new URL(request.url);
      // Decode pathname to preserve spaces and international characters
      let filePath = decodeURIComponent(url.pathname);
      
      // On Windows, url.pathname might start with /C:/...
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }

      const normalized = path.normalize(filePath);
      if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
        return net.fetch(pathToFileURL(normalized).toString());
      }
      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error('Error handling zos-file protocol:', err);
      return new Response('Invalid request', { status: 400 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Communications
ipcMain.handle('file:read', async (_event, filePath) => {
  return await readFile(filePath);
});

ipcMain.handle('file:write', async (_event, { filePath, content, options }) => {
  return await writeFile(filePath, content, options);
});

ipcMain.handle('file:show-open-dialog', async () => {
  return await showOpenDialog(mainWindow);
});

ipcMain.handle('file:show-save-dialog', async (_event, defaultName) => {
  return await showSaveDialog(mainWindow, defaultName);
});

ipcMain.handle('dialog:unsaved-prompt', async (_event, fileName) => {
  return await promptUnsavedChanges(mainWindow, fileName);
});

ipcMain.handle('app:get-settings', async () => {
  return loadSettings();
});

ipcMain.handle('app:save-settings', async (_event, newSettings) => {
  return saveSettings(newSettings);
});

ipcMain.handle('app:get-startup-file', async () => {
  const file = fileToOpenOnStartup;
  fileToOpenOnStartup = null; // Consume once
  return file;
});

ipcMain.handle('app:set-title', async (_event, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});
