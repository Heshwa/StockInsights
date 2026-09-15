import test from 'node:test';
import assert from 'node:assert/strict';

import { processInventoryData, collectStoresForResponses } from './dataProcessor.js';
import { KNOWN_STORES } from '../config/sheets.js';

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

test('adds response-only stores missing from the master list', () => {
  const out = processInventoryData([{
    Timestamp: '9/10/2026 15:57:22',
    'Store name': 'Rajendra Nagar',
    'Curd 1Kg Tub - Stock availability': '25',
    'Curd 1Kg Expiry Date': '9/15/2026',
    'Curd 400g Cup- Stock Availabiity': '12',
    'Curd 400g Cup - Expiry Date ': '9/14/2026',
    'Yogurt Mango- Stock Availabiity': '26',
    'Yogurt Mango  - Expiry Date ': '9/22/2026',
    'Yogurt Blueberry- Stock Availabiity': '10',
    'Yogurt Blueberry- Expiry Date ': '9/15/2026'
  }], stores);

  const rajendra = out.find((s) => s.storeName === 'Rajendra Nagar');
  assert.ok(rajendra, 'response-only store should appear');
  assert.equal(rajendra.hasAnyData, true);
  assert.equal(rajendra.fromSheet, true);
  const bySku = Object.fromEntries(rajendra.products.map((p) => [p.sku, p]));
  assert.equal(bySku['Curd 1Kg Tub'].stock, 25);
  assert.equal(bySku['Yogurt Mango'].stock, 26);
  assert.equal(bySku['Yogurt Mango'].expiryDate, '9/22/2026');
  assert.equal(bySku['Curd 400g Cup'].criticalLevel, 3);
  assert.equal(bySku['Yogurt Blueberry'].criticalLevel, 10);
});

test('keeps master stores without data as no-data instead of dropping them', () => {
  const out = processInventoryData([{
    Timestamp: '9/10/2026 15:57:22',
    'Store name': 'Rajendra Nagar',
    'Curd 1Kg Tub - Stock availability': '25',
    'Curd 1Kg Expiry Date': '9/15/2026'
  }], stores);
  assert.equal(out.find((s) => s.storeName === 'Yeshwanthpura').status, 'no-data');
});

test('preserves google sheet column order for products (hyderabad sheet)', () => {
  const out = processInventoryData([{
    Timestamp: '9/10/2026 15:57:22',
    'Store name': 'Kukatpally',
    'Curd 1Kg Tub - Stock availability': '25',
    'Curd 1Kg Expiry Date': '9/15/2026',
    'Curd 1Kg Pouch- Stock Availabiity': '34',
    'Curd 1Kg Pouch - Expiry Date ': '9/17/2026',
    'Curd 400g Cup- Stock Availabiity': '12',
    'Curd 400g Cup - Expiry Date ': '9/14/2026',
    'Yogurt Mango- Stock Availabiity': '26',
    'Yogurt Mango  - Expiry Date ': '9/22/2026'
  }], stores);
  const order = out.find((s) => s.storeName === 'Kukatpally').products.map((p) => p.sku);
  assert.deepEqual(order.slice(0, 4), ['Curd 1Kg Tub', 'Curd 1Kg Pouch', 'Curd 400g Cup', 'Yogurt Mango']);
});

test('collectStoresForResponses merges master + response-only stores', () => {
  const merged = collectStoresForResponses([{ 'Store name': 'Rajendra Nagar' }], stores);
  assert.ok(merged.some((s) => s['Store Name'] === 'Rajendra Nagar'));
  assert.ok(merged.some((s) => s['Store Name'] === 'Yeshwanthpura'));
});

test('hyderabad tab is scoped to the four hyderabad stores', () => {
  assert.deepEqual(KNOWN_STORES.hyderabad, ['Kukatpally', 'Uppal', 'Rajendra Nagar', 'Kompally']);
  assert.deepEqual(KNOWN_STORES.bangalore.length, 6);
});

test('places Paneer 165gm with the other Paneers, not last (bangalore sheet)', () => {
  const out = processInventoryData([{
    Timestamp: '8/24/2026 12:15:40',
    'Store name': 'Kanakapura',
    'Curd 1Kg Tub - Stock availability': '5',
    'Curd 1Kg Expiry Date': '9/19/2026',
    'Paneer 200gm - Stock Availability ': '60',
    'Paneer 200gm Expiry Date': '9/19/2026',
    'Paneer 165gm Expiry Date': '9/11/2026',
    'Paneer 500gm - Stock Avialbility': '22',
    'Paneer 500 gm Expiry date': '10/23/2026',
    'Mysore Pak - Stock Availability': '4',
    'Mysore Pak - Expiry Date ': '10/17/2026',
    'Paneer 165gm - Stock Availability ': '46'
  }], stores);
  const order = out[0].products.map((p) => p.sku);
  assert.deepEqual(
    order.filter((s) => s.startsWith('Paneer')),
    ['Paneer 200gm', 'Paneer 165gm', 'Paneer 500gm']
  );
});

test('merges Kangapura responses into the Kanakapura card', () => {
  const master = [{ 'Store ID': '10601135', 'Store Name': 'Kanakapura', 'Store Code': 'TOSL' }];
  const out = processInventoryData([
    {
      Timestamp: '8/24/2026 12:15:40',
      'Store name': 'Kanakapura',
      'Curd 1Kg Tub - Stock availability': '5',
      'Curd 1Kg Expiry Date': '9/19/2026'
    },
    {
      Timestamp: '8/29/2026 15:15:09',
      'Store name': 'Kangapura',
      'Curd 1Kg Tub - Stock availability': '18',
      'Curd 1Kg Expiry Date': '9/11/2026'
    }
  ], master);
  const names = out.map((s) => s.storeName);
  assert.ok(!names.some((n) => /kangapura/i.test(n) && !/kanakapura/i.test(n)), `no separate Kangapura card, got: ${names}`);
  const kanak = out.find((s) => /kanakapura/i.test(s.storeName));
  assert.ok(kanak.hasAnyData, 'merged card should have data');
  // Latest timestamp wins (Kangapura row is newer).
  assert.equal(kanak.products.find((p) => p.sku === 'Curd 1Kg Tub').stock, 18);
});
