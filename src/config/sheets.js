export const SHEETS_STORAGE_KEY = 'stockinsights_sheets_v1';

export const MAIN_SHEET_ID = '1PyCT1HTPvcGb_70eYPcrhCp-AgjGrLTi7tJ4gGIpVd8';
export const RAJENDRA_SHEET_ID = '1QDEL8u5983ZQeqGD1vxvYB3mmRYKc2PQC2YSuXVk9hY';

export const DEFAULT_SHEETS = [
  {
    id: 'main',
    name: 'Main',
    sheetId: MAIN_SHEET_ID,
    allowedUsers: ['yoga', 'user'],
  },
  {
    id: 'rajendra-nagar',
    name: 'Rajendra Nagar',
    sheetId: RAJENDRA_SHEET_ID,
    allowedUsers: ['rajendra', 'yoga'],
  },
];

const isValidSheet = (s) =>
  s &&
  typeof s.id === 'string' &&
  typeof s.name === 'string' &&
  typeof s.sheetId === 'string' &&
  s.name.trim() !== '' &&
  s.sheetId.trim() !== '' &&
  Array.isArray(s.allowedUsers);

export const loadSheets = () => {
  try {
    const raw = localStorage.getItem(SHEETS_STORAGE_KEY);
    if (!raw) return migrateLegacySheet([...DEFAULT_SHEETS]);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return migrateLegacySheet([...DEFAULT_SHEETS]);
    const valid = parsed.filter(isValidSheet);
    if (valid.length === 0) return migrateLegacySheet([...DEFAULT_SHEETS]);
    return valid;
  } catch {
    return [...DEFAULT_SHEETS];
  }
};

// Preserve a previous single-sheet admin setting (pre multi-sheet) by
// applying the legacy localStorage sheetId to the Main sheet.
const migrateLegacySheet = (sheets) => {
  try {
    const legacy = (localStorage.getItem('sheetId') || '').trim();
    if (!legacy) return sheets;
    if (legacy === MAIN_SHEET_ID || legacy === RAJENDRA_SHEET_ID) return sheets;
    return sheets.map((s) => (s.id === 'main' ? { ...s, sheetId: legacy } : s));
  } catch {
    return sheets;
  }
};

export const saveSheets = (sheets) => {
  localStorage.setItem(SHEETS_STORAGE_KEY, JSON.stringify(sheets));
};

export const resetSheets = () => {
  localStorage.removeItem(SHEETS_STORAGE_KEY);
};

export const makeSheetId = () =>
  `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// Accepts a bare ID or a full Google Sheets URL and returns the ID.
export const extractSheetId = (input) => {
  const v = (input || '').trim();
  if (!v) return '';
  const m = v.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
};

export const criticalKeyForSheet = (configId) => `criticalLevelSettings_${configId}`;

export const loadCriticalForSheet = (configId, fallback = {}) => {
  try {
    const raw = localStorage.getItem(criticalKeyForSheet(configId));
    if (raw) return JSON.parse(raw);
    // One-time migration: legacy global key belongs to the Main sheet.
    if (configId === 'main') {
      const legacy =
        localStorage.getItem('criticalLevelSettings') ||
        localStorage.getItem('criticalLevelOverrides');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        localStorage.setItem(criticalKeyForSheet(configId), JSON.stringify(parsed));
        return parsed;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
};

export const saveCriticalForSheet = (configId, settings) => {
  localStorage.setItem(criticalKeyForSheet(configId), JSON.stringify(settings));
};
