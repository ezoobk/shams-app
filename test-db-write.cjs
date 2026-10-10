/**
 * Debug script: Run `node test-db-write.cjs` from project root to verify 
 * that SQLite writes are actually persisting between process restarts.
 */
const path = require('path');
const os = require('os');
const { initDatabase } = require('./electron/database/index.cjs');

(async () => {
  const folderPath = path.join(os.homedir(), 'Documents', 'ShamsAppData');
  console.log(`Using DB folder: ${folderPath}`);
  
  const db = await initDatabase(folderPath);
  
  // 1. Write a test customer
  const testId = 'TEST_' + Date.now();
  await db.run('INSERT OR REPLACE INTO customers (id, name, phone, notes) VALUES (?, ?, ?, ?)',
    testId, 'عميل اختباري', '0911111111', 'ملاحظة اختبار');
  console.log('✅ Write test customer:', testId);

  // 2. Read it back immediately
  const row = await db.get('SELECT * FROM customers WHERE id = ?', testId);
  console.log('✅ Read back:', row.name, '-', row.phone);

  // 3. Count all customers
  const count = await db.get('SELECT COUNT(*) as c FROM customers');
  console.log('✅ Total customers in DB:', count.c);

  // 4. Cleanup test record
  await db.run('DELETE FROM customers WHERE id = ?', testId);
  console.log('✅ Cleaned up test record');

  // 5. Show DB file path
  const sqlite3 = require('sqlite3');
  console.log('\n📦 DB file location:', path.join(folderPath, 'ShamsDatabase.sqlite'));

})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
