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
const compression = require('compression');
const path = require('path');
const { getDb, getMigrationStatus } = require('./database/index.cjs');
let electronApp;
try { electronApp = require('electron').app; } catch (e) {}
const PORT = parseInt(process.env.SERVER_PORT || (electronApp?.isPackaged ? '3111' : '3112'), 10);

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
      row.id = String(row.id).replace(/\.0$/, '');
      row.materials = parseJSON(row.materials) || [];
      row.specs = parseJSON(row.specs) || [];
      const rawAtts = parseJSON(row.attachments) || [];
      // Strip heavy base64 'data' to save 4+ MB over network, but preserve metadata so count/name/type are available
      row.attachments = rawAtts.map(a => {
        if (a && a.data && a.data.length > 500) {
          return { name: a.name, type: a.type, size: a.size || a.data.length, hasData: true };
        }
        return a;
      });
    } else if (table === 'work_orders') {
      const items = parseJSON(row.items) || [];
      row.items = items.map(item => {
        if (item && Array.isArray(item.attachments)) {
          item.attachments = item.attachments.map(a => {
            if (a && a.data && a.data.length > 500) {
              return { name: a.name, type: a.type, size: a.size || a.data.length, hasData: true };
            }
            return a;
          });
        }
        return item;
      });
    } else if (['invoices', 'deleted_invoices'].includes(table)) {
      const items = parseJSON(row.items) || [];
      row.items = items.map(item => {
        if (item && Array.isArray(item.attachments)) {
          item.attachments = item.attachments.map(a => {
            if (a && a.data && a.data.length > 500) {
              return { name: a.name, type: a.type, size: a.size || a.data.length, hasData: true };
            }
            return a;
          });
        }
        return item;
      });
      if (row.createdBy) {
        row.createdBy = parseJSON(row.createdBy) || row.createdBy;
      }
    } else if (table === 'letters') {
      let extra = parseJSON(row.data) || {};
      row.blocks = parseJSON(row.blocks) || extra.blocks || [];
      row.isArchived = !!row.isArchived;
      row.to = row.to_name || extra.to || extra.customerName || '';
      row.customerName = row.to_name || extra.customerName || extra.to || '';
      row.customerId = row.customerId || extra.customerId || '';
      row.senderUserId = row.senderUserId || extra.senderUserId || '';
      row.senderName = row.senderName || extra.senderName || '';
      row.senderTitle = row.senderTitle || extra.senderTitle || '';
      row.senderSignature = row.senderSignature || extra.senderSignature || '';
      row.senderStamp = row.senderStamp || extra.senderStamp || '';
      row = { ...extra, ...row };
    } else if (table === 'users') {
      return parseJSON(row.data) || row;
    } else if (table === 'audit_logs') {
      const parsed = parseJSON(row.data) || row;
      // Strip heavy snapshots from collection list to prevent transferring 12MB+ of duplicate data across HTTP
      const { previousState, nextState, ...summary } = parsed;
      return {
        ...summary,
        hasPreviousState: !!previousState,
        hasNextState: !!nextState
      };
    } else if (table === 'shipping_orders') {
      let parsed = parseJSON(row.data);
      if (parsed && !Array.isArray(parsed) && parsed.id) return parsed;
      row.data = parsed || [];
      row.items = Array.isArray(parsed) ? parsed : [];
    } else if (table === 'purchase_invoices') {
      row.items = parseJSON(row.items) || [];
      row.attachments = parseJSON(row.attachments) || [];
    } else if (table === 'hr_shifts') {
      row.workDays = parseJSON(row.workDays) || [];
    } else if (table === 'hr_employees') {
      row.shiftIds = parseJSON(row.shiftIds) || (row.shiftId ? [row.shiftId] : []);
      row.isZkLinked = row.isZkLinked !== undefined && row.isZkLinked !== null ? Boolean(row.isZkLinked) : true;
      row.attendanceMode = row.attendanceMode || (row.isZkLinked ? 'biometric' : (row.salaryType === 'daily' ? 'manual' : 'auto_present'));
    } else if (table === 'hr_payroll_records') {
      row.data = parseJSON(row.data) || [];
    } else if (table === 'hr_settlements') {
      row.isSettled = row.isSettled !== undefined && row.isSettled !== null ? Boolean(row.isSettled) : true;
    }
    return row;
  });
}

function createApiServer() {
  const app = express();

  // Allow all origins on the local network
  app.use(cors({ origin: '*' }));
  app.use(compression({
    filter: (req, res) => {
      if (req.headers.accept === 'text/event-stream' || req.path === '/api/events') return false;
      return compression.filter(req, res);
    }
  }));
  app.use(express.json({ limit: '50mb' }));

  // ── Server-Sent Events (Real-time Sync) ───────────────────────────────────
  const clients = new Set();
  const notifyClients = (table) => {
    for (const client of clients) {
      try {
        client.write(`data: ${JSON.stringify({ type: 'DB_CHANGE', table })}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  };

  // Heartbeat ping every 25 seconds to keep connection alive through Cloudflare/proxies (avoids Error 524)
  const ssePing = setInterval(() => {
    for (const client of clients) {
      try {
        client.write(': ping\n\n');
      } catch (e) {
        clients.delete(client);
      }
    }
  }, 25000);

  // Listen to global IPC/DB events
  const { dbEvents } = require('./database/index.cjs');
  dbEvents.on('change', (table) => notifyClients(table));

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
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

  // ── High-Fidelity Server-Side PDF Rendering via Electron Chromium ─────────
  app.post('/api/render-pdf', async (req, res) => {
    let win = null;
    try {
      const { html, styles, printScale = 90, fileName = 'Document.pdf' } = req.body;
      if (!html) {
        return res.status(400).json({ success: false, error: 'HTML content is required' });
      }

      let electronBW;
      try { electronBW = require('electron').BrowserWindow; } catch (e) {}

      if (!electronBW) {
        return res.status(503).json({ success: false, error: 'Electron BrowserWindow unavailable' });
      }

      win = new electronBW({
        show: false,
        width: 1200,
        height: 1600,
        webPreferences: {
          offscreen: true,
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const scaleFactor = Math.max(0.7, Math.min(1.2, Number(printScale) / 100));

      let bundledCss = '';
      try {
        const fs = require('fs');
        const assetsDir = path.join(__dirname, '..', 'dist', 'assets');
        if (fs.existsSync(assetsDir)) {
          const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
          if (cssFiles.length > 0) {
            bundledCss = fs.readFileSync(path.join(assetsDir, cssFiles[0]), 'utf8');
          }
        }
      } catch (cssErr) {}

      const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
      background: white;
    }
    .print-page {
      position: relative;
      direction: rtl !important;
      text-align: right !important;
      page-break-after: always;
      break-after: page;
      background: white;
      width: 100%;
      padding: 6mm 8mm !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }
    .print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    table { page-break-inside: auto; break-inside: auto; width: 100%; border-collapse: collapse; }
    thead { display: table-header-group !important; }
    tfoot { display: table-footer-group !important; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    .break-inside-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }
    img { -webkit-print-color-adjust: exact; print-color-adjust: exact; max-height: 120px; object-fit: contain; }
    ${bundledCss ? `\n/* Bundled Tailwind CSS */\n${bundledCss}\n` : ''}
    ${styles || ''}
  </style>
</head>
<body style="zoom: ${scaleFactor}">
  ${html}
</body>
</html>`;

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
      await new Promise(r => setTimeout(r, 200));

      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginType: 'custom',
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const cleanFileName = String(fileName).replace(/[\/\\:*?"<>|\r\n\t]/g, '-').replace(/\s+/g, '_').trim();
      let safeAscii = cleanFileName.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_');
      if (safeAscii === '_.pdf' || safeAscii === '.pdf' || safeAscii.length < 5) {
        safeAscii = 'Document.pdf';
      }
      const encodedUtf8 = encodeURIComponent(cleanFileName);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('[server] render-pdf error:', err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      if (win) {
        try { win.destroy(); } catch (e) {}
      }
    }
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
      } else if (table === 'audit_logs') {
        query += ' ORDER BY timestamp DESC';
      } else if (table === 'hr_attendance_logs') {
        query += ' ORDER BY checkTime DESC';
      } else if (table === 'hr_employees') {
        query += ' ORDER BY name ASC';
      } else if (table === 'hr_shifts') {
        query += ' ORDER BY startTime ASC';
      } else if (table === 'hr_transactions') {
        query += ' ORDER BY date DESC';
      } else if (table === 'hr_leaves') {
        query += ' ORDER BY startDate DESC';
      } else if (table === 'hr_payroll_records') {
        query += ' ORDER BY month DESC';
      } else if (table === 'hr_settlements') {
        query += ' ORDER BY settlementDate DESC';
      }
      const rows = await db.all(query);
      const parsedRows = hydrateRows(table, rows);
      res.json({ success: true, data: parsedRows });
    } catch (err) {
      console.error(`[API] GET collection ${table} error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Single Audit Log with full snapshots on-demand ─────────────────────────
  app.get('/api/collection/audit_logs/:id', async (req, res) => {
    try {
      const db = getDb();
      const row = await db.get('SELECT * FROM audit_logs WHERE id = ?', [req.params.id]);
      if (!row) return res.status(404).json({ success: false, error: 'Audit log not found' });
      const parsed = parseJSON(row.data) || row;
      res.json({ success: true, data: parsed });
    } catch (err) {
      console.error(`[API] GET audit_logs ${req.params.id} error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Estimate Attachments On-Demand ─────────────────────────────────────────
  app.get('/api/estimates/:id/attachments', async (req, res) => {
    try {
      const db = getDb();
      const cleanId = String(req.params.id).replace(/\.0$/, '');
      const row = await db.get('SELECT attachments FROM estimates WHERE id = ? OR id = ?', [cleanId, cleanId + '.0']);
      if (!row) return res.status(404).json({ success: false, error: 'Estimate not found' });
      const attachments = parseJSON(row.attachments) || [];
      res.json({ success: true, data: attachments });
    } catch (err) {
      console.error(`[API] GET estimate attachments error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Single Work Order with full items/attachments ──────────────────────────
  app.get('/api/work_orders/:id', async (req, res) => {
    try {
      const db = getDb();
      const row = await db.get('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
      if (!row) return res.status(404).json({ success: false, error: 'Work order not found' });
      row.items = parseJSON(row.items) || [];
      res.json({ success: true, data: row });
    } catch (err) {
      console.error(`[API] GET work order error:`, err.message);
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
            for (const e of items) {
              const cleanId = String(e.id).replace(/\.0$/, '');
              let finalAttachments = e.attachments || [];
              if (Array.isArray(finalAttachments) && finalAttachments.some(a => a && a.hasData && !a.data)) {
                const existing = await db.get('SELECT attachments FROM estimates WHERE id = ? OR id = ?', [cleanId, cleanId + '.0']);
                if (existing && existing.attachments) {
                  const existingAtts = parseJSON(existing.attachments) || [];
                  const existingMap = new Map(existingAtts.map(a => [a.name, a]));
                  finalAttachments = finalAttachments.map(a => {
                    if (a && a.hasData && !a.data && existingMap.has(a.name)) {
                      return existingMap.get(a.name);
                    }
                    return a;
                  });
                }
              }
              await stmt.run(cleanId, e.date, e.desc, e.chassis, String(e.length), String(e.width), String(e.height), e.sellPrice || 0, e.totalCost || 0, e.profitPercentage || 0, e.categoryId || null, JSON.stringify(e.materials || []), JSON.stringify(e.specs || []), JSON.stringify(finalAttachments), e.notes || null, e.lastUpdated || null);
            }
            break;
          case 'work_orders':
            stmt = await db.prepare('INSERT OR REPLACE INTO work_orders (id, date, customerName, items) VALUES (?, ?, ?, ?)');
            for (const w of items) {
              let finalItems = w.items || [];
              if (Array.isArray(finalItems) && finalItems.some(it => Array.isArray(it.attachments) && it.attachments.some(a => a && a.hasData && !a.data))) {
                const existing = await db.get('SELECT items FROM work_orders WHERE id = ?', [w.id]);
                if (existing && existing.items) {
                  const existingItems = parseJSON(existing.items) || [];
                  const existingItemMap = new Map(existingItems.map(it => [(it.serialNumber || it.id), it]));
                  finalItems = finalItems.map(it => {
                    const match = existingItemMap.get(it.serialNumber || it.id);
                    if (match && Array.isArray(match.attachments) && Array.isArray(it.attachments)) {
                      const matchAttMap = new Map(match.attachments.map(a => [a.name, a]));
                      const mergedAtts = it.attachments.map(a => {
                        if (a && a.hasData && !a.data && matchAttMap.has(a.name)) {
                          return matchAttMap.get(a.name);
                        }
                        return a;
                      });
                      return { ...it, attachments: mergedAtts };
                    }
                    return it;
                  });
                }
              }
              await stmt.run(w.id, w.date, w.customerName || null, JSON.stringify(finalItems));
            }
            break;
          case 'invoices':
          case 'deleted_invoices':
            stmt = await db.prepare(`INSERT OR REPLACE INTO ${table} (id, date, customerName, customerId, type, items, total, discount, netTotal, notes, terms, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const inv of items) {
              const createdByVal = typeof inv.createdBy === 'object' && inv.createdBy !== null ? JSON.stringify(inv.createdBy) : (inv.createdBy || null);
              await stmt.run(inv.id, inv.date, inv.customerName, inv.customerId || null, inv.type, JSON.stringify(inv.items || []), inv.total || 0, inv.discount || 0, inv.netTotal || 0, inv.notes || null, inv.terms || null, createdByVal);
            }
            break;
          case 'letters':
            stmt = await db.prepare('INSERT OR REPLACE INTO letters (id, date, to_name, subject, blocks, isArchived, customerId, senderUserId, senderName, senderTitle, senderSignature, senderStamp, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const l of items) {
              const toName = l.to || l.customerName || l.to_name || null;
              await stmt.run(
                l.id,
                l.date,
                toName,
                l.subject || '',
                JSON.stringify(l.blocks || []),
                l.isArchived ? 1 : 0,
                l.customerId || null,
                l.senderUserId || null,
                l.senderName || null,
                l.senderTitle || null,
                l.senderSignature || null,
                l.senderStamp || null,
                JSON.stringify(l)
              );
            }
            break;
          case 'users':
            stmt = await db.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)');
            for (const u of items) await stmt.run(u.id, JSON.stringify(u));
            break;
          case 'audit_logs':
            stmt = await db.prepare('INSERT OR REPLACE INTO audit_logs (id, timestamp, data) VALUES (?, ?, ?)');
            for (const a of items) await stmt.run(a.id, a.timestamp, JSON.stringify(a));
            break;
          case 'shipping_orders':
            stmt = await db.prepare('INSERT OR REPLACE INTO shipping_orders (id, date, destination, data) VALUES (?, ?, ?, ?)');
            for (const s of items) await stmt.run(s.id, s.date, s.destination || null, JSON.stringify(s));
            break;
          case 'suppliers':
            stmt = await db.prepare('INSERT OR REPLACE INTO suppliers (id, name, phone, address, notes) VALUES (?, ?, ?, ?, ?)');
            for (const s of items) await stmt.run(s.id, s.name, s.phone || null, s.address || null, s.notes || null);
            break;
          case 'purchase_invoices':
            stmt = await db.prepare('INSERT OR REPLACE INTO purchase_invoices (id, date, supplierName, supplierId, invoiceNumber, items, total, discount, netTotal, notes, attachments, status, createdBy, createdById) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const inv of items) await stmt.run(inv.id, inv.date, inv.supplierName, inv.supplierId || null, inv.invoiceNumber || null, JSON.stringify(inv.items || []), inv.total || 0, inv.discount || 0, inv.netTotal || 0, inv.notes || null, JSON.stringify(inv.attachments || []), inv.status || 'completed', inv.createdBy || null, inv.createdById || null);
            break;
          case 'hr_shifts':
            stmt = await db.prepare('INSERT OR REPLACE INTO hr_shifts (id, name, startTime, endTime, lateGraceMinutes, earlyGraceMinutes, isSplitShift, splitBreakStart, splitBreakEnd, workHours, workDays, color, isDefault, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const s of items) {
              await stmt.run(s.id, s.name, s.startTime || '08:00', s.endTime || '17:00', s.lateGraceMinutes ?? 10, s.earlyGraceMinutes ?? 10, s.isSplitShift ? 1 : 0, s.splitBreakStart || '13:00', s.splitBreakEnd || '14:00', s.workHours || 8, JSON.stringify(s.workDays || []), s.color || '#2563eb', s.isDefault ? 1 : 0, s.notes || null);
            }
            break;
          case 'hr_employees':
            stmt = await db.prepare('INSERT OR REPLACE INTO hr_employees (id, badgeNumber, name, phone, ssn, deptId, deptName, jobTitle, shiftId, shiftIds, isZkLinked, attendanceMode, salaryType, basicSalary, dailyRate, hourlyRate, overtimeMode, overtimePercent, overtimeFixedAmount, hireDate, isActive, notes, terminationDate, terminationReason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const e of items) {
              const shiftIdsArr = Array.isArray(e.shiftIds) && e.shiftIds.length > 0 ? e.shiftIds : (e.shiftId ? [e.shiftId] : []);
              const shiftIdsJson = shiftIdsArr.length > 0 ? JSON.stringify(shiftIdsArr) : null;
              const primaryShiftId = shiftIdsArr[0] || e.shiftId || null;
              const isZkLinkedVal = e.isZkLinked !== false ? 1 : 0;
              const attendanceModeVal = e.attendanceMode || (isZkLinkedVal ? 'biometric' : (e.salaryType === 'daily' ? 'manual' : 'auto_present'));
              await stmt.run(e.id, e.badgeNumber || null, e.name, e.phone || null, e.ssn || null, e.deptId || null, e.deptName || null, e.jobTitle || null, primaryShiftId, shiftIdsJson, isZkLinkedVal, attendanceModeVal, e.salaryType || 'monthly', e.basicSalary || 0, e.dailyRate || 0, e.hourlyRate || 0, e.overtimeMode || 'general', e.overtimePercent || 125, e.overtimeFixedAmount || 0, e.hireDate || null, e.isActive !== false ? 1 : 0, e.notes || null, e.terminationDate || null, e.terminationReason || null);
            }
            break;
          case 'hr_attendance_logs':
            stmt = await db.prepare('INSERT OR REPLACE INTO hr_attendance_logs (id, userId, badgeNumber, checkTime, checkType, verifyCode, sn, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const l of items) {
              await stmt.run(l.id, l.userId, l.badgeNumber || null, l.checkTime, l.checkType || 'I', l.verifyCode || null, l.sn || null, l.source || 'manual', l.notes || null);
            }
            break;
          case 'hr_transactions':
            stmt = await db.prepare('INSERT OR REPLACE INTO hr_transactions (id, employeeId, employeeName, type, amount, date, month, reason, status, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const t of items) {
              await stmt.run(t.id, t.employeeId, t.employeeName || null, t.type, t.amount || 0, t.date, t.month || null, t.reason || null, t.status || 'pending', t.createdBy || null);
            }
            break;
          case 'hr_leaves':
            stmt = await db.prepare('INSERT OR REPLACE INTO hr_leaves (id, employeeId, employeeName, type, startDate, endDate, hours, reason, status, approvedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const lv of items) {
              await stmt.run(lv.id, lv.employeeId, lv.employeeName || null, lv.type, lv.startDate, lv.endDate, lv.hours || 0, lv.reason || null, lv.status || 'approved', lv.approvedBy || null);
            }
            break;
          case 'hr_payroll_records':
            stmt = await db.prepare('INSERT OR REPLACE INTO hr_payroll_records (id, month, generatedAt, data, totalNet, totalDeductions, totalAdditions, isApproved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            for (const p of items) {
              await stmt.run(p.id, p.month, p.generatedAt, JSON.stringify(p.data || []), p.totalNet || 0, p.totalDeductions || 0, p.totalAdditions || 0, p.isApproved ? 1 : 0);
            }
            break;
          case 'hr_settlements':
            stmt = await db.prepare(`INSERT OR REPLACE INTO hr_settlements (
              id, employeeId, employeeName, badgeNumber, deptName, jobTitle, settlementDate, month, startDate, endDate, reason, reasonDetails,
              salaryType, baseSalaryOrRate, actualWorkDays, absentDays, earnedSalary, overtimeHours, overtimeAmount, bonuses, allowances,
              leaveBalancePayout, endOfServiceGratuity, totalAdditions, lateMinutes, earlyMinutes, delayDeduction, advances, deductions,
              otherDeductions, totalDeductions, netPayable, paymentMethod, payoutDate, notes, approvedAt, approvedBy, isSettled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const s of items) {
              await stmt.run(
                s.id, s.employeeId, s.employeeName, s.badgeNumber || null, s.deptName || null, s.jobTitle || null, s.settlementDate, s.month, s.startDate, s.endDate, s.reason, s.reasonDetails || null,
                s.salaryType || 'monthly', s.baseSalaryOrRate || 0, s.actualWorkDays || 0, s.absentDays || 0, s.earnedSalary || 0, s.overtimeHours || 0, s.overtimeAmount || 0, s.bonuses || 0, s.allowances || 0,
                s.leaveBalancePayout || 0, s.endOfServiceGratuity || 0, s.totalAdditions || 0, s.lateMinutes || 0, s.earlyMinutes || 0, s.delayDeduction || 0, s.advances || 0, s.deductions || 0,
                s.otherDeductions || 0, s.totalDeductions || 0, s.netPayable || 0, s.paymentMethod || 'نقداً', s.payoutDate || null, s.notes || null, s.approvedAt || null, s.approvedBy || null, s.isSettled ? 1 : 0
              );
            }
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
      const expandedIds = new Set();
      for (const id of ids) {
        if (id === null || id === undefined) continue;
        const strId = String(id);
        expandedIds.add(strId);
        if (strId.endsWith('.0')) {
          expandedIds.add(strId.replace(/\.0$/, ''));
        } else {
          expandedIds.add(`${strId}.0`);
        }
      }
      const finalIds = Array.from(expandedIds);
      const placeholders = finalIds.map(() => '?').join(',');
      await db.run(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ...finalIds);

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

  // ── Atomic ID Generator ──────────────────────────────────────────────────────
  app.post('/api/generate-id', async (req, res) => {
    try {
      delete require.cache[require.resolve('./database/idGenerator.cjs')];
      const { generateNextId } = require('./database/idGenerator.cjs');
      const result = await generateNextId(req.body);
      res.json({
        ...result,
        data: { id: result.id, ...result }
      });
    } catch (err) {
      console.error('[API] generate-id error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Backups API ──────────────────────────────────────────────────────────────
  const backupManager = require('./database/backupManager.cjs');
  backupManager.startBackupScheduler();

  app.get('/api/backups', (req, res) => {
    try {
      const result = backupManager.listBackups();
      res.json(result);
    } catch (err) {
      console.error('[API] List backups error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups/create', async (req, res) => {
    try {
      const type = req.body?.type || 'manual';
      const result = await backupManager.createBackup(type);
      res.json(result);
    } catch (err) {
      console.error('[API] Create backup error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups/restore', async (req, res) => {
    try {
      const fileName = req.body?.fileName;
      if (!fileName) return res.status(400).json({ success: false, error: 'اسم الملف مطلوب.' });
      const result = await backupManager.restoreBackup(fileName);
      res.json(result);
    } catch (err) {
      console.error('[API] Restore backup error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/backups/:fileName', (req, res) => {
    try {
      const { fileName } = req.params;
      const result = backupManager.deleteBackup(fileName);
      res.json(result);
    } catch (err) {
      console.error('[API] Delete backup error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/backups/download/:fileName', (req, res) => {
    try {
      const { fileName } = req.params;
      const safeName = path.basename(fileName);
      const filePath = path.join(backupManager.getBackupFolder(), safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('الملف غير موجود.');
      }
      res.download(filePath, safeName);
    } catch (err) {
      console.error('[API] Download backup error:', err.message);
      res.status(500).send(err.message);
    }
  });

  app.get('/api/backups/config', (req, res) => {
    try {
      res.json({ success: true, data: backupManager.getConfig(), backupFolder: backupManager.getBackupFolder() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups/config', (req, res) => {
    try {
      const updated = backupManager.saveConfig(req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups/test-destination', (req, res) => {
    try {
      const folderPath = req.body?.path;
      if (!folderPath) return res.status(400).json({ success: false, error: 'المسار مطلوب' });
      const result = backupManager.testFolderAccess(folderPath);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups/test-gdrive', async (req, res) => {
    try {
      const { email, key, folderId } = req.body || {};
      if (!email || !key) return res.status(400).json({ success: false, error: 'البريد الإلكتروني والمفتاح الخاص مطلوبان' });
      const result = await backupManager.testGoogleDriveConnection(email, key, folderId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/backups/detect-gdrive', (req, res) => {
    try {
      const paths = backupManager.detectLocalGoogleDrivePaths();
      res.json({ success: true, data: paths });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── ZKTeco Biometric Endpoints ─────────────────────────────────────────────
  app.get('/api/zkteco/test', async (req, res) => {
    try {
      try { delete require.cache[require.resolve('./zktecoBridge.cjs')]; } catch(e){}
      const { testZkConnection, DEFAULT_MDB_PATH, DEFAULT_DEVICE_IP, DEFAULT_DEVICE_PORT } = require('./zktecoBridge.cjs');
      const mode = req.query.mode || (req.query.ip ? 'direct' : 'direct');
      const result = await testZkConnection({
        mode,
        ip: req.query.ip || DEFAULT_DEVICE_IP,
        port: req.query.port || DEFAULT_DEVICE_PORT,
        path: req.query.path || DEFAULT_MDB_PATH
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/zkteco/sync', async (req, res) => {
    try {
      const db = getDb();
      try { delete require.cache[require.resolve('./zktecoBridge.cjs')]; } catch(e){}
      const { syncZkToDatabase, syncZkDirectToDatabase, DEFAULT_MDB_PATH, DEFAULT_DEVICE_IP, DEFAULT_DEVICE_PORT } = require('./zktecoBridge.cjs');
      const mode = req.body?.mode || (req.body?.ip ? 'direct' : (req.body?.connectionMode || 'direct'));
      
      let result;
      if (mode === 'direct') {
        const ip = req.body?.ip || DEFAULT_DEVICE_IP;
        const port = Number(req.body?.port) || DEFAULT_DEVICE_PORT;
        result = await syncZkDirectToDatabase(ip, port, db, req.body || {});
      } else {
        const targetPath = req.body?.path || DEFAULT_MDB_PATH;
        result = await syncZkToDatabase(targetPath, db, req.body || {});
      }

      const { dbEvents } = require('./database/index.cjs');
      dbEvents.emit('change', 'hr_attendance_logs');
      if (result.upsertedUsersCount > 0 || result.purgedUsersCount > 0 || result.deactivatedUsersCount > 0 || req.body?.syncEmployees || req.body?.matchActiveOnly) {
        dbEvents.emit('change', 'hr_employees');
        dbEvents.emit('change', 'hr_shifts');
      }
      res.json(result);
    } catch (err) {
      console.error('[API] /api/zkteco/sync error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/zkteco/stats', async (req, res) => {
    try {
      const db = getDb();
      const statsRow = await db.get("SELECT value FROM store WHERE key = 'zk_sync_stats'");
      const lastSyncRow = await db.get("SELECT value FROM store WHERE key = 'zk_last_sync'");
      res.json({
        success: true,
        data: {
          lastSync: lastSyncRow ? parseJSON(lastSyncRow.value) : null,
          stats: statsRow ? parseJSON(statsRow.value) : null
        }
      });
    } catch (err) {
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
      const port = (typeof address === 'object' && address?.port) ? address.port : PORT;
      console.log(`[API Server] Listening on http://0.0.0.0:${port}`);
      console.log(`[API Server] Local network: http://192.168.2.111:${port}`);
      console.log(`[API Server] Public Tunnel: https://erb.shams.com.ly`);
      resolve(server);
    });
    server.on('error', (err) => {
      console.error('[API Server] Failed to start:', err.message);
      reject(err);
    });
  });
}

module.exports = { createApiServer };
