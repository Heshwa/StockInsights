import test from 'node:test';
import assert from 'node:assert/strict';

import { processInventoryData } from './dataProcessor.js';

const stores = [{
  'Store ID': '1',
  'Store Name': 'Yeshwanthpura',
  'Store Code': 'TOSM'
}];

const getPaneer = (responses) => {
  const store = processInventoryData(responses, stores)[0];
  return Object.fromEntries(
    store.products
      .filter(product => product.sku.startsWith('Paneer'))
      .map(product => [product.sku, product])
  );
};

test('moves the legacy Paneer 200gm expiry off Paneer 165gm', () => {
  const products = getPaneer([{
    Timestamp: '8/9/2026 19:27:29',
    'Store name': 'Yeshwanthpura',
    'Paneer 200gm - Stock Availability ': '28',
    'Paneer 200gm Manufacturing Date': '',
    'Paneer 165gm Expiry Date': '9/7/2026',
    'Paneer 165gm - Stock Availability ': '',
    'Paneer 200gm Expiry Date': ''
  }]);

  assert.equal(products['Paneer 165gm'].stock, 'N/A');
  assert.equal(products['Paneer 165gm'].expiryDate, null);
  assert.equal(products['Paneer 165gm'].hasData, false);
  assert.equal(products['Paneer 200gm'].stock, 28);
  assert.equal(products['Paneer 200gm'].expiryDate, '9/7/2026');
});

test('keeps current Paneer 165gm and 200gm expiry fields separate', () => {
  const products = getPaneer([{
    Timestamp: '8/12/2026 16:51:07',
    'Store name': 'Yeshwanthpura',
    'Paneer 200gm - Stock Availability ': '60',
    'Paneer 200gm Manufacturing Date': '',
    'Paneer 165gm Expiry Date': '9/11/2026',
    'Paneer 165gm - Stock Availability ': '46',
    'Paneer 200gm Expiry Date': '9/19/2026'
  }]);

  assert.equal(products['Paneer 165gm'].stock, 46);
  assert.equal(products['Paneer 165gm'].expiryDate, '9/11/2026');
  assert.equal(products['Paneer 200gm'].stock, 60);
  assert.equal(products['Paneer 200gm'].expiryDate, '9/19/2026');
});

test('does not show an expiry date for an exact SKU with zero stock', () => {
  const products = getPaneer([{
    Timestamp: '8/12/2026 20:28:14',
    'Store name': 'Yeshwanthpura',
    'Paneer 200gm - Stock Availability ': '48',
    'Paneer 200gm Manufacturing Date': '',
    'Paneer 165gm Expiry Date': '9/11/2026',
    'Paneer 165gm - Stock Availability ': '0',
    'Paneer 200gm Expiry Date': '9/19/2026'
  }]);

  assert.equal(products['Paneer 165gm'].stock, 0);
  assert.equal(products['Paneer 165gm'].expiryDate, null);
  assert.equal(products['Paneer 165gm'].daysLeft, null);
  assert.equal(products['Paneer 165gm'].isCritical, true);
});
