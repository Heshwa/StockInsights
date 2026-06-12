import Papa from 'papaparse';

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

/**
 * Reconciles the response data with store master and critical levels
 */
export const processInventoryData = (responses, criticalLevels, stores) => {
  const normalize = (str) => str?.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Use first non-empty response row for column detection
  const headerRow = responses.find(r => Object.keys(r).length > 2) || responses[0];

  // Sort responses by timestamp descending to get latest first
  const sortedResponses = [...responses]
    .filter(r => r['Timestamp']) // drop empty rows
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

  // Pre-compute SKU column mappings once for all SKUs
  const skuMeta = criticalLevels
    .filter(item => item.SKU && item.SKU.trim())
    .map(item => ({
      sku: item.SKU,
      criticalLevel: parseInt(item['Critical Stock Level'] || 0, 10),
      expiryThreshold: parseInt(item['Expiry Alert - Days to expiry'] || 0, 10),
      cols: findSkuColumns(headerRow, item.SKU)
    }));

  // Debug: log column mappings to console for verification
  console.log('SKU Column Mappings:', skuMeta.map(m => ({ sku: m.sku, ...m.cols })));

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

      // Map each SKU to its latest known status for this store
      const latestStatus = skuMeta.map(meta => {
        const { cols } = meta;

        // Find the latest response that has ANY data for this SKU's stock column
        const response = storeResponses.find(r => 
          cols.stock && r[cols.stock] !== undefined && r[cols.stock] !== ''
        );
        
        const rawStock = response ? response[cols.stock] : null;
        const stock = rawStock !== null ? normalizeStockCount(rawStock) : null;
        const expiryDate = response ? (response[cols.expiry] || null) : null;
        const daysLeft = calculateDaysToExpiry(expiryDate);
        
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
          hasData: !!response,
          isCritical,
          isExpiringSoon,
          isExpired,
          lastUpdated: response ? response['Timestamp'] : null
        };
      });

      // Determine store-wide health only from items with actual data
      const hasCritical = latestStatus.some(s => s.isCritical);
      const hasExpiring = latestStatus.some(s => s.isExpiringSoon || s.isExpired);
      const mostRecentUpdate = storeResponses[0]?.['Timestamp'] || 'No data';
      
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

  // Character-set based fuzzy word match — handles typos like choccolate/chocolate
  const charSetMatch = (skuWord, colKey) => {
    const skuChars = new Set(skuWord.split(''));
    const colWords = colKey.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(w => w.length > 1);
    return colWords.some(cw => {
      const cwChars = new Set(cw.split(''));
      const skuArr = [...skuChars];
      const matched = skuArr.filter(c => cwChars.has(c)).length;
      return matched / skuArr.length >= 0.8;
    });
  };

  const isMatch = (key) => {
    const k = key.toLowerCase();
    // Hard constraint: every numeric token must appear verbatim
    if (numericTokens.length > 0 && !numericTokens.every(n => k.includes(n))) return false;
    // Soft constraint: ≥ 60% of non-numeric words must fuzzy-match
    if (skuWords.length > 0) {
      const matched = skuWords.filter(w => charSetMatch(w, k)).length;
      if (matched / skuWords.length < 0.6) return false;
    }
    return true;
  };

  const skuCols = keys.filter(isMatch);
  
  return {
    stock: skuCols.find(k => k.toLowerCase().includes('stock') || k.toLowerCase().includes('avail')) || '',
    manufacturing: skuCols.find(k => k.toLowerCase().includes('manuf')) || '',
    expiry: skuCols.find(k => k.toLowerCase().includes('expir')) || ''
  };
}
