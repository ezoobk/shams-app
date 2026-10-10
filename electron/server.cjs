/**
 * Express HTTP API Server
 * 
 * يُشغَّل داخل Main Process للـ Electron.
 * يكشف نفس عمليات قاعدة البيانات كـ REST API عبر الشبكة المحلية،
 * مما يتيح للأجهزة الأخرى الوصول إلى البيانات عبر HTTP.
 * 
 * يُستمع على: 0.0.0.0:3111 (جميع الواجهات الشبكية)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, getMigrationStatus } = require('./database/index.cjs');
const { app: electronApp } = require('electron');

const PORT = parseInt(process.env.SERVER_PORT || (electronApp.isPackaged ? '3111' : '3112'), 10);

// Helpers for generic JSON parsing
const parseJSON = (str) => {
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch (e) { return null; }
};

// Parse table rows to hydrate JSON fields
function hydrateRows(table, rows) {
//... (unchanged inner part)
  return rows.map(row => {
    if (table === 'master_materials') {
      row.worksOfIds = parseJSON(row.worksOfIds) || [];
    } else if (table === 'estimates') {
      row.materials = parseJSON(row.materials) || [];
      row.specs = parseJSON(row.specs) || [];
      row.attachments = parseJSON(row.attachments) || [];
    } else if (['work_orders', 'invoices', 'deleted_invoices'].includes(table)) {
      row.items = parseJSON(row.items) || [];
    } else if (table === 'letters') {
      row.blocks = parseJSON(row.blocks) || [];
      row.isArchived = !!row.isArchived;
      row.to = row.to_name; row.customerName = row.to_name;
    } else if (table === 'users') {
      return parseJSON(row.data) || row;
    } else if (table === 'shipping_orders') {
      let parsed = parseJSON(row.data);
      if (parsed && !Array.isArray(parsed) && parsed.id) return parsed;
      row.data = parsed || [];
      row.items = Array.isArray(parsed) ? parsed : [];
    }
    return row;
  });
}

function createApiServer() {
  const app = express();

  // Allow all origins on the local network
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '50mb' }));

  // ── Server-Sent Events (Real-time Sync) ───────────────────────────────────
  const clients = new Set();
  const notifyClients = (table) => {
    for (const client of clients) {
      client.write(`data: ${JSON.stringify({ type: 'DB_CHANGE', table })}\n\n`);
    }
  };

  // Listen to global IPC/DB events
  const { dbEvents } = require('./database/index.cjs');
  dbEvents.on('change', (table) => notifyClients(table));

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);
    
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  // ── Serve Frontend Static Files ──────────────────────────────────────────
  // Serve the 'dist' folder built by Vite.
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // ── Health Check ────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'online', timestamp: Date.now() });
  });

  // ── Migration Status ─────────────────────────────────────────────────────────
  app.get('/api/migration-status', (req, res) => {
    res.json({ success: true, data: getMigrationStatus() });
  });

  // ── Get Collection ───────────────────────────────────────────────────────────
  app.get('/api/collection/:table', async (req, res) => {
    const { table } = req.params;
    try {
      const db = getDb();
      let query = `SELECT * FROM ${table}`;
      if (table === 'works_of' || table === 'master_items') {
        query += ' ORDER BY orderIndex ASC, id ASC';
      }
      const rows = await db.all(query);
      const parsedRows = hydrateRows(table, rows);
      res.json({ success: true, data: parsedRows });
    } catch (err) {
      console.error(`[API] GET collection ${table} error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Bulk Upsert ──────────────────────────────────────────────────────────────
  let transactionMutex = Promise.resolve();

  app.post('/api/collection/:table/upsert', async (req, res) => {
    const { table } = req.params;
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.json({ success: true });

    transactionMutex = transactionMutex.then(async () => {
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
            for (const s of items) await stmt.run(s.id, s.date, s.destination || null, JSON.stringify(s));
            break;
        }
        if (stmt) await stmt.finalize();
        await db.exec('COMMIT');
        
        const { dbEvents } = require('./database/index.cjs');
        dbEvents.emit('change', table);

        res.json({ success: true });
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
      } catch (err) {
        console.error(`[API] Upsert ${table} error:`, err.message);
        res.status(500).json({ success: false, error: err.message });
      }
    }).catch(err => {
      console.error('Unhandled mutex error:', err);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Internal Server Error' });
    });
  });

  // ── Bulk Delete ──────────────────────────────────────────────────────────────
  app.post('/api/collection/:table/delete', async (req, res) => {
    const { table } = req.params;
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.json({ success: true });
    try {
      const db = getDb();
      const placeholders = ids.map(() => '?').join(',');
      await db.run(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ...ids);

      const { dbEvents } = require('./database/index.cjs');
      dbEvents.emit('change', table);

      res.json({ success: true });
    } catch (err) {
      console.error(`[API] Delete from ${table} error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Get Store Object ─────────────────────────────────────────────────────────
  app.get('/api/store/:key', async (req, res) => {
    const { key } = req.params;
    try {
      const db = getDb();
      const row = await db.get('SELECT value FROM store WHERE key = ?', key);
      res.json({ success: true, data: row ? parseJSON(row.value) : null });
    } catch (err) {
      console.error(`[API] Get store ${key} error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Set Store Object ─────────────────────────────────────────────────────────
  app.post('/api/store/:key', async (req, res) => {
    const { key } = req.params;
    const value = req.body;
    try {
      const db = getDb();
      await db.run('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)', key, JSON.stringify(value));
      res.json({ success: true });
    } catch (err) {
      console.error(`[API] Set store ${key} error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── SPA Fallback ─────────────────────────────────────────────────────────────
  // Redirect all other requests to index.html for React Router (if used)
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ── Start server on 0.0.0.0 (all network interfaces) ────────────────────────
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      const address = server.address();
      console.log(`[API Server] Listening on http://0.0.0.0:${address.port}`);
      console.log(`[API Server] Local network: http://192.168.2.111:${address.port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      console.error('[API Server] Failed to start:', err.message);
      reject(err);
    });
  });
}

module.exports = { createApiServer };
