/**
 * Normalizes stock count strings into numbers
 */
export const normalizeStockCount = (value) => {
  if (!value || value === '' || value.toLowerCase() === 'no') return 0;
  if (value.toLowerCase() === 'yes') return 1; // Default for "Yes" if no count provided
  
  // Extract numbers using regex (handles "10pc", "10 units", etc.)
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

/**
 * Calculates days until expiry
 */
export const calculateDaysToExpiry = (expiryDateStr) => {
  if (!expiryDateStr) return null;
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const normalizeSkuKey = (str) => str?.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || '';

const defaultCriticalRows = [
  ['Curd 1Kg Tub', 4, 7],
  ['Curd Pouch', 3, 7],
  ['Paneer 165gm', 10, 10],
  ['Paneer 200gm', 10, 10],
  ['Paneer 500gm', 3, 10],
  ['Mysore Pak', 2, 15],
  ['Dhoodh Peda', 12, 15],
  ['Badam Milk 175ml', 360, 45],
  ['Badam Milk Glass', 4, 45],
  ['Pista Milk Glass', 4, 45],
  ['Choccolate Thickshake', 24, 45],
  ['Vanilla Thickshake', 24, 45],
  ['Strawberry Thickshake', 24, 45],
  ['UHT Lassi', 24, 45],
  ['UHT Buttermilk', 24, 45],
  ['Recharge Apple', 48, 45],
  ['Recharge Mango', 48, 45],
  ['Recharge Orange', 48, 45],
  ['110ml Badam Milk', 180, 45],
  ['Milkyshot Chocolate', 24, 45],
  ['Milkyshot Caramel', 24, 45],
  ['Kesar Milk', 180, 45]
];

export const DEFAULT_CRITICAL_SETTINGS = defaultCriticalRows.reduce((acc, [sku, criticalLevel, expiryThreshold]) => {
  acc[normalizeSkuKey(sku)] = { criticalLevel, expiryThreshold };
  return acc;
}, {});

// Ordered list of normalized SKU keys from the default rows, used to sort
// products in the UI so they appear in the intended default order regardless
// of the Google Sheet column order.
const DEFAULT_SKU_ORDER = defaultCriticalRows.map(([sku]) => normalizeSkuKey(sku));

const extractSkuNameFromColumn = (columnName) => {
  if (!columnName) return '';
  return columnName
    .replace(/\s*-\s*(stock|availability|stock availability|stock availabiity|stock avialbility|stock availbility).*$/i, '')
    .trim();
};

const isStockColumn = (key) => {
  const normalized = key.toLowerCase();
  return normalized.includes('stock') || normalized.includes('avail');
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const PANEER_165_KEY = normalizeSkuKey('Paneer 165gm');
const PANEER_200_KEY = normalizeSkuKey('Paneer 200gm');

const getCriticalSetting = (criticalSettings, sku) => {
  const candidates = [
    sku,
    sku.replace(/Choccolate/i, 'Chocolate'),
    sku.replace(/Vanilla/i, 'Vannila'),
    sku.replace(/Dhoodh/i, 'Doodh'),
    sku.replace(/Milkyshot/i, 'Milky Shot'),
    `${sku} Pet`
  ];

  const findSetting = (settings) => candidates
    .map(candidate => settings[normalizeSkuKey(candidate)])
    .find(Boolean);

  return {
    ...(findSetting(DEFAULT_CRITICAL_SETTINGS) || {}),
    ...(findSetting(criticalSettings) || {})
  };
};

export const buildSkuMeta = (responses, criticalSettings = {}) => {
  const headerRow = responses.find(r => Object.keys(r).length > 2) || responses[0];
  if (!headerRow) return [];

  return Object.keys(headerRow)
    .filter(isStockColumn)
    .map(stockColumn => {
      const sku = extractSkuNameFromColumn(stockColumn);
      const setting = getCriticalSetting(criticalSettings, sku);
      const cols = findSkuColumns(headerRow, sku);

      return {
        sku,
        criticalLevel: parseInt(setting.criticalLevel ?? 0, 10),
        expiryThreshold: parseInt(setting.expiryThreshold ?? 45, 10),
        cols
      };
    })
    .filter(item => item.sku)
    // Sort by the default order so products appear in the intended sequence
    // in the UI regardless of the Google Sheet column order. Items not in the
    // default list keep their original sheet order and appear after defaults.
    .sort((a, b) => {
      const ia = DEFAULT_SKU_ORDER.indexOf(normalizeSkuKey(a.sku));
      const ib = DEFAULT_SKU_ORDER.indexOf(normalizeSkuKey(b.sku));
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
};

/**
 * Reconciles the response data with store master and critical settings.
 * Uses ONLY the most recent response row per store — no merging across rows.
 */
export const processInventoryData = (responses, stores, criticalSettings = {}) => {
  const normalize = (str) => str?.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  // Sort responses by timestamp descending to get latest first
  const sortedResponses = [...responses]
    .filter(r => r['Timestamp']) // drop empty rows
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

  // Pre-compute SKU column mappings once for all SKUs. Display names come from
  // the response sheet headers so spelling stays consistent with form data.
  const skuMeta = buildSkuMeta(responses, criticalSettings);

  // Map stores with fuzzy matching
  const storeData = stores
    .filter(store => store['Store Name'])
    .map(store => {
      const sName = normalize(store['Store Name']);
      
      // Find responses for this store, accounting for typos
      const storeResponses = sortedResponses.filter(r => {
        const rName = normalize(r['Store name'] || '');
        if (!rName) return false;
        // Direct match, substring match, or match on first ~5 significant chars
        return rName === sName || rName.includes(sName) || sName.includes(rName) ||
               (sName.slice(0, 5) === rName.slice(0, 5));
      });

      const hasAnyData = storeResponses.length > 0;
      
      // Use ONLY the latest (most recent) response row for this store.
      // sortedResponses[0] is the most recent entry due to descending sort.
      const latestResponse = storeResponses[0] || null;

      // Map each SKU using data from the single latest response row only
      const latestStatus = skuMeta.map(meta => {
        const { cols } = meta;

        // Only check the latest response row for stock and expiry
        let stock = null;
        let expiryDate = null;

        if (latestResponse && cols.stock && hasValue(latestResponse[cols.stock])) {
          const rawStock = latestResponse[cols.stock];
          stock = normalizeStockCount(rawStock);
        }

        if (latestResponse && cols.expiry && hasValue(latestResponse[cols.expiry])) {
          expiryDate = String(latestResponse[cols.expiry]).trim();
        }

        // Paneer 165gm was added to the form after responses had already been
        // collected for Paneer 200gm. In the sheet, the old 200gm expiry
        // column was renamed to "Paneer 165gm Expiry Date", while new 165gm
        // stock and 200gm expiry columns were appended later. For a response
        // submitted before those new fields existed, move that legacy date
        // back to Paneer 200gm instead of displaying it against Paneer 165gm.
        if (
          latestResponse &&
          normalizeSkuKey(meta.sku) === PANEER_200_KEY &&
          stock !== null &&
          stock > 0 &&
          !expiryDate
        ) {
          const paneer165Meta = skuMeta.find(item => normalizeSkuKey(item.sku) === PANEER_165_KEY);
          const paneer165StockValue = paneer165Meta?.cols.stock
            ? latestResponse[paneer165Meta.cols.stock]
            : null;
          const legacyPaneer200Expiry = paneer165Meta?.cols.expiry
            ? latestResponse[paneer165Meta.cols.expiry]
            : null;

          if (!hasValue(paneer165StockValue) && hasValue(legacyPaneer200Expiry)) {
            expiryDate = String(legacyPaneer200Expiry).trim();
          }
        }

        // An expiry date is only actionable while units of that exact SKU are
        // in stock. This also prevents a legacy/misaligned date from making a
        // zero-stock or missing-stock product look healthy.
        if (stock === null || stock <= 0) {
          expiryDate = null;
        }
        
        const daysLeft = calculateDaysToExpiry(expiryDate);
        const hasDataForSku = stock !== null || expiryDate !== null;
        
        // Only flag as critical if we actually have data (stock !== null)
        const isCritical = stock !== null && stock <= meta.criticalLevel;
        const isExpiringSoon = daysLeft !== null && daysLeft <= meta.expiryThreshold && daysLeft >= 0;
        const isExpired = daysLeft !== null && daysLeft < 0;

        return {
          sku: meta.sku,
          stock: stock !== null ? stock : 'N/A',
          criticalLevel: meta.criticalLevel,
          expiryThreshold: meta.expiryThreshold,
          expiryDate,
          daysLeft,
          hasData: hasDataForSku,
          isCritical,
          isExpiringSoon,
          isExpired,
          lastUpdated: latestResponse ? latestResponse['Timestamp'] : null
        };
      });

      // Determine store-wide health only from items with actual data
      const hasCritical = latestStatus.some(s => s.isCritical);
      const hasExpiring = latestStatus.some(s => s.isExpiringSoon || s.isExpired);
      const mostRecentUpdate = latestResponse?.['Timestamp'] || 'No data';
      
      return {
        storeId: store['Store ID'],
        storeName: store['Store Name'],
        storeCode: store['Store Code'],
        products: latestStatus,
        hasAnyData,
        status: !hasAnyData ? 'no-data' : hasCritical ? 'critical' : hasExpiring ? 'warning' : 'healthy',
        lastUpdated: mostRecentUpdate
      };
    });

  return storeData;
};

/**
 * Finds stock, manufacturing, and expiry columns for a given SKU using a
 * two-tier matching strategy:
 *  1. HARD: Numeric tokens (e.g. "200", "500") MUST exactly appear in the column key.
 *     This prevents "Paneer 200gm" from matching "Paneer 500gm" columns.
 *  2. SOFT: Non-numeric words are matched by character-set overlap (≥ 80%) to handle
 *     spelling typos like "Choccolate" vs "Chocolate", "Dhoodh" vs "Doodh", etc.
 */
function findSkuColumns(row, sku) {
  if (!row) return { stock: '', manufacturing: '', expiry: '' };
  
  const keys = Object.keys(row);

  // --- Extract numeric and word tokens from the SKU ---
  const numericTokens = sku.match(/\d+/g) || [];
  const skuWords = sku.toLowerCase()
    .replace(/\d+/g, '')
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .filter(w => w.length > 1);

  const levenshtein = (a, b) => {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        matrix[i][j] = a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]) + 1;
      }
    }

    return matrix[a.length][b.length];
  };

  const wordMatches = (skuWord, colWord) => {
    if (skuWord === colWord || skuWord.includes(colWord) || colWord.includes(skuWord)) return true;
    return levenshtein(skuWord, colWord) / Math.max(skuWord.length, colWord.length) <= 0.34;
  };

  const matchScore = (key) => {
    const k = key.toLowerCase();
    // Hard constraint: every numeric token must appear verbatim
    if (numericTokens.length > 0 && !numericTokens.every(n => k.includes(n))) return 0;

    const colWords = k.replace(/[^a-z ]/g, ' ').split(' ').filter(w => w.length > 1);
    const missingWords = skuWords.filter(w => !colWords.some(cw => wordMatches(w, cw)));
    const matched = skuWords.length - missingWords.length;
    const optionalPackagingMiss = missingWords.length === 1 && ['pet', 'tub'].includes(missingWords[0]);

    if (skuWords.length > 0 && missingWords.length > 0 && !optionalPackagingMiss) return 0;
    return matched + numericTokens.length;
  };

  const bestColumn = (typeMatcher) => keys
    .map(key => ({ key, score: matchScore(key) }))
    .filter(({ key, score }) => score > 0 && typeMatcher(key.toLowerCase()))
    .sort((a, b) => b.score - a.score || a.key.length - b.key.length)[0]?.key || '';
  
  return {
    stock: bestColumn(k => k.includes('stock') || k.includes('avail')),
    manufacturing: bestColumn(k => k.includes('manuf')),
    expiry: bestColumn(k => k.includes('expir'))
  };
}
