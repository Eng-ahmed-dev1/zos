import fs from 'fs';
import path from 'path';
import electron from 'electron';
const app = electron?.app || electron;


const SETTINGS_FILE_NAME = 'zos-pad-settings.json';

function getSettingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
}

const defaultSettings = {
  window: {
    width: 960,
    height: 680,
    x: undefined,
    y: undefined,
    isMaximized: false,
  },
  theme: 'dark', // 'dark' or 'light'
  wordWrap: 'on',
  fontSize: 14,
};

export function loadSettings() {
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...defaultSettings, ...parsed, window: { ...defaultSettings.window, ...(parsed.window || {}) } };
    }
  } catch (err) {
    console.error('Failed to load settings, using defaults:', err);
  }
  return { ...defaultSettings };
}

export function saveSettings(newSettings) {
  try {
    const filePath = getSettingsPath();
    const current = loadSettings();
    const merged = { ...current, ...newSettings };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}
