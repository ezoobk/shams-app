const { ipcMain } = require('electron');
const { getDb, getMigrationStatus } = require('./index.cjs');

// Helpers for generic JSON parsing
const parseJSON = (str) => { 
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch (e) { return null; } 
};

function registerIpcHandlers() {
  
  // 0. Migration Status
  ipcMain.handle('get-migration-status', () => {
    return getMigrationStatus();
  });
  
  // 1. Get Collection
  ipcMain.handle('db-get-collection', async (event, table) => {
    try {
      const db = getDb();
      let query = `SELECT * FROM ${table}`;
      if (table === 'works_of' || table === 'master_items') {
        query += ' ORDER BY orderIndex ASC, id ASC';
      }
      const rows = await db.all(query);
      
      // Parse JSON fields depending on table
      const parsedRows = rows.map(row => {
        if (table === 'master_materials') {
          row.worksOfIds = parseJSON(row.worksOfIds) || [];
        } else if (table === 'estimates') {
          row.materials = parseJSON(row.materials) || [];
          row.specs = parseJSON(row.specs) || [];
          row.attachments = parseJSON(row.attachments) || [];
        } else if (table === 'work_orders' || table === 'invoices' || table === 'deleted_invoices') {
          row.items = parseJSON(row.items) || [];
        } else if (table === 'letters') {
          row.blocks = parseJSON(row.blocks) || [];
          row.isArchived = !!row.isArchived;
          row.to = row.to_name; row.customerName = row.to_name;
        } else if (table === 'users') {
      return parseJSON(row.data) || row;
    } else if (table === 'shipping_orders') {
          // إصلاح الخطأ القاتل: استخراج المصفوفة فقط دون طمس الـ id و date
          let parsed = parseJSON(row.data);
          if (parsed && !Array.isArray(parsed) && parsed.id) {
            return parsed; // دعم للبيانات القديمة إذا كان الكائن بأكمله محفوظاً
          }
          row.data = parsed || [];
          row.items = Array.isArray(parsed) ? parsed : [];
        }
        return row;
      });

      return { success: true, data: parsedRows };
    } catch (err) {
      console.error(`Error getting collection ${table}:`, err);
      return { success: false, error: err.message };
    }
  });

  // 2. Bulk Upsert
  let ipcTransactionMutex = Promise.resolve();

  ipcMain.handle('db-bulk-upsert', async (event, table, items) => {
    if (!items || items.length === 0) return { success: true };
    
    return ipcTransactionMutex = ipcTransactionMutex.then(async () => {
      try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
      try {
        let stmt;
        switch (table) {
          case 'customers':
            stmt = await db.prepare('INSERT OR REPLACE INTO customers (id, name, phone, notes) VALUES (?, ?, ?, ?)');
            for (const c of items) await stmt.run(c.id, c.name, c.phone || null, c.notes || null);
            break;
          case 'drivers':
            stmt = await db.prepare('INSERT OR REPLACE INTO drivers (id, name, phone, truckNumber, license, trailerNumber) VALUES (?, ?, ?, ?, ?, ?)');
            for (const d of items) await stmt.run(d.id, d.name, d.phone || null, d.truckNumber || null, d.license || null, d.trailerNumber || null);
            break;
          case 'master_materials':
            stmt = await db.prepare('INSERT OR REPLACE INTO master_materials (id, name, shortName, defaultPrice, unit, worksOfIds) VALUES (?, ?, ?, ?, ?, ?)');
            for (const m of items) await stmt.run(m.id, m.name, m.shortName || null, m.defaultPrice || 0, m.unit || '', JSON.stringify(m.worksOfIds || []));
            break;
          case 'works_of':
            stmt = await db.prepare('INSERT OR REPLACE INTO works_of (id, name, orderIndex) VALUES (?, ?, ?)');
            for (const w of items) await stmt.run(w.id, w.name, w.orderIndex || 0);
            break;
          case 'master_items':
            stmt = await db.prepare('INSERT OR REPLACE INTO master_items (id, worksOfId, name, orderIndex) VALUES (?, ?, ?, ?)');
            for (const i of items) await stmt.run(i.id, i.worksOfId, i.name, i.orderIndex || 0);
            break;
          case 'estimate_categories':
            stmt = await db.prepare('INSERT OR REPLACE INTO estimate_categories (id, name) VALUES (?, ?)');
            for (const c of items) await stmt.run(c.id, c.name);
            break;
          case 'estimates':
            stmt = await db.prepare('INSERT OR REPLACE INTO estimates (id, date, desc, chassis, length, width, height, sellPrice, totalCost, profitPercentage, categoryId, materials, specs, attachments, notes, lastUpdated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const e of items) await stmt.run(e.id, e.date, e.desc, e.chassis, String(e.length), String(e.width), String(e.height), e.sellPrice || 0, e.totalCost || 0, e.profitPercentage || 0, e.categoryId || null, JSON.stringify(e.materials || []), JSON.stringify(e.specs || []), JSON.stringify(e.attachments || []), e.notes || null, e.lastUpdated || null);
            break;
          case 'work_orders':
            stmt = await db.prepare('INSERT OR REPLACE INTO work_orders (id, date, customerName, items) VALUES (?, ?, ?, ?)');
            for (const w of items) await stmt.run(w.id, w.date, w.customerName || null, JSON.stringify(w.items || []));
            break;
          case 'invoices':
          case 'deleted_invoices':
            stmt = await db.prepare(`INSERT OR REPLACE INTO ${table} (id, date, customerName, customerId, type, items, total, discount, netTotal, notes, terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const inv of items) await stmt.run(inv.id, inv.date, inv.customerName, inv.customerId || null, inv.type, JSON.stringify(inv.items || []), inv.total || 0, inv.discount || 0, inv.netTotal || 0, inv.notes || null, inv.terms || null);
            break;
          case 'letters':
            stmt = await db.prepare('INSERT OR REPLACE INTO letters (id, date, to_name, subject, blocks, isArchived) VALUES (?, ?, ?, ?, ?, ?)');
            for (const l of items) await stmt.run(l.id, l.date, l.to || l.customerName || null, l.subject, JSON.stringify(l.blocks || []), l.isArchived ? 1 : 0);
            break;
          case 'users':
            stmt = await db.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)');
            for (const u of items) await stmt.run(u.id, JSON.stringify(u));
            break;
          case 'shipping_orders':
            stmt = await db.prepare('INSERT OR REPLACE INTO shipping_orders (id, date, destination, data) VALUES (?, ?, ?, ?)');
            // Save the entire object in data to preserve driver, customerName, and items
            for (const s of items) await stmt.run(s.id, s.date, s.destination || null, JSON.stringify(s));
            break;
        }
        if(stmt) await stmt.finalize();
        await db.exec('COMMIT');
        
        // Notify all clients (HTTP & Electron)
        const { dbEvents } = require('./index.cjs');
        dbEvents.emit('change', table);
        
        return { success: true };
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
      } catch (err) {
        console.error(`Error upserting into ${table}:`, err);
        return { success: false, error: err.message };
      }
    }).catch(err => {
      console.error('Unhandled mutex error in IPC:', err);
      return { success: false, error: 'Internal Server Error' };
    });
  });

  // 3. Bulk Delete
  ipcMain.handle('db-bulk-delete', async (event, table, ids) => {
    if (!ids || ids.length === 0) return { success: true };
    try {
      const db = getDb();
      const placeholders = ids.map(() => '?').join(',');
      await db.run(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ...ids);
      
      const { dbEvents } = require('./index.cjs');
      dbEvents.emit('change', table);
      
      return { success: true };
    } catch (err) {
      console.error(`Error deleting from ${table}:`, err);
      return { success: false, error: err.message };
    }
  });

  // 4. Get Object (from store)
  ipcMain.handle('db-get-object', async (event, key) => {
    try {
      const db = getDb();
      const row = await db.get('SELECT value FROM store WHERE key = ?', key);
      return { success: true, data: row ? parseJSON(row.value) : null };
    } catch (err) {
      console.error(`Error getting object ${key}:`, err);
      return { success: false, error: err.message };
    }
  });

  // 5. Set Object (to store)
  ipcMain.handle('db-set-object', async (event, key, value) => {
    try {
      const db = getDb();
      await db.run('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)', key, JSON.stringify(value));
      
      const { dbEvents } = require('./index.cjs');
      dbEvents.emit('change', key);

      return { success: true };
    } catch (err) {
      console.error(`Error setting object ${key}:`, err);
      return { success: false, error: err.message };
    }
  });

}

module.exports = { registerIpcHandlers };