const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zosApi', {
  // File I/O
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content, options) =>
    ipcRenderer.invoke('file:write', { filePath, content, options }),
  showOpenDialog: () => ipcRenderer.invoke('file:show-open-dialog'),
  showSaveDialog: (defaultName) => ipcRenderer.invoke('file:show-save-dialog', defaultName),

  // Dialogs
  promptUnsavedChanges: (fileName) =>
    ipcRenderer.invoke('dialog:unsaved-prompt', fileName),
  showErrorBox: (title, content) =>
    ipcRenderer.invoke('dialog:show-error', { title, content }),

  // Settings & Startup
  getSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveSettings: (newSettings) => ipcRenderer.invoke('app:save-settings', newSettings),
  getStartupFile: () => ipcRenderer.invoke('app:get-startup-file'),
  setTitle: (title) => ipcRenderer.invoke('app:set-title', title),

  // Event Listeners from Main Process
  onMenuAction: (callback) => {
    const subscription = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', subscription);
    return () => ipcRenderer.removeListener('menu:action', subscription);
  },
  onOpenFile: (callback) => {
    const subscription = (_event, filePath) => callback(filePath);
    ipcRenderer.on('app:open-file-path', subscription);
    return () => ipcRenderer.removeListener('app:open-file-path', subscription);
  },

  // Platform info
  platform: process.platform,
});
