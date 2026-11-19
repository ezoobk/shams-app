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
      } else if (table === 'hr_overtime_records') {
        query += ' ORDER BY date DESC, employeeName ASC';
      }
      const rows = await db.all(query);
      
      // Parse JSON fields depending on table
      const parsedRows = rows.map(row => {
        if (table === 'master_materials') {
          row.worksOfIds = parseJSON(row.worksOfIds) || [];
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
        } else if (table === 'estimates') {
          row.id = String(row.id).replace(/\.0$/, '');
          row.materials = parseJSON(row.materials) || [];
          row.specs = parseJSON(row.specs) || [];
          const rawAtts = parseJSON(row.attachments) || [];
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
        } else if (table === 'invoices' || table === 'deleted_invoices') {
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
          const { previousState, nextState, ...summary } = parsed;
          return {
            ...summary,
            hasPreviousState: !!previousState,
            hasNextState: !!nextState
          };
        } else if (table === 'shipping_orders') {
          // إصلاح الخطأ القاتل: استخراج المصفوفة فقط دون طمس الـ id و date
          let parsed = parseJSON(row.data);
          if (parsed && !Array.isArray(parsed) && parsed.id) {
            return parsed; // دعم للبيانات القديمة إذا كان الكائن بأكمله محفوظاً
          }
          row.data = parsed || [];
          row.items = Array.isArray(parsed) ? parsed : [];
        } else if (table === 'purchase_invoices') {
          row.items = parseJSON(row.items) || [];
          row.attachments = parseJSON(row.attachments) || [];
        }
        return row;
      });

      return { success: true, data: parsedRows };
    } catch (err) {
      console.error(`Error getting collection ${table}:`, err);
      return { success: false, error: err.message };
    }
  });

  // 1.1 Single Audit Log
  ipcMain.handle('db-get-audit-log', async (event, id) => {
    try {
      const db = getDb();
      const row = await db.get('SELECT * FROM audit_logs WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Audit log not found' };
      const parsed = parseJSON(row.data) || row;
      return { success: true, data: parsed };
    } catch (err) {
      console.error(`Error getting audit log ${id}:`, err);
      return { success: false, error: err.message };
    }
  });

  // 1.2 Estimate Attachments
  ipcMain.handle('db-get-estimate-attachments', async (event, id) => {
    try {
      const db = getDb();
      const cleanId = String(id).replace(/\.0$/, '');
      const row = await db.get('SELECT attachments FROM estimates WHERE id = ? OR id = ?', [cleanId, cleanId + '.0']);
      if (!row) return { success: false, error: 'Estimate not found' };
      const attachments = parseJSON(row.attachments) || [];
      return { success: true, data: attachments };
    } catch (err) {
      console.error(`Error getting estimate attachments ${id}:`, err);
      return { success: false, error: err.message };
    }
  });

  // 1.3 Single Work Order
  ipcMain.handle('db-get-work-order', async (event, id) => {
    try {
      const db = getDb();
      const row = await db.get('SELECT * FROM work_orders WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Work order not found' };
      row.items = parseJSON(row.items) || [];
      return { success: true, data: row };
    } catch (err) {
      console.error(`Error getting work order ${id}:`, err);
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
            // Save the entire object in data to preserve driver, customerName, and items
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

  // 6. Generate Next ID Atomically
  const { generateNextId } = require('./idGenerator.cjs');
  ipcMain.handle('db-generate-id', async (event, params) => {
    return generateNextId(params);
  });

  // ─── 7. ZKTeco Biometric Bridge Handlers ─────────────────────────────────
  const {
    DEFAULT_MDB_PATH,
    DEFAULT_DEVICE_IP,
    DEFAULT_DEVICE_PORT,
    testZkConnection,
    syncZkToDatabase,
    syncZkDirectToDatabase
  } = require('../zktecoBridge.cjs');

  ipcMain.handle('zk-test-connection', async (event, options = {}) => {
    try {
      const mode = typeof options === 'object' ? (options.mode || (options.ip ? 'direct' : 'direct')) : 'direct';
      return await testZkConnection({
        mode,
        ip: options?.ip || DEFAULT_DEVICE_IP,
        port: options?.port || DEFAULT_DEVICE_PORT,
        path: options?.path || DEFAULT_MDB_PATH
      });
    } catch (err) {
      console.error('Error testing ZK connection:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('zk-sync-attendance', async (event, options = {}) => {
    try {
      const db = getDb();
      const mode = options.mode || (options.ip ? 'direct' : (options.connectionMode || 'direct'));
      let res;
      if (mode === 'direct') {
        const ip = options.ip || DEFAULT_DEVICE_IP;
        const port = Number(options.port) || DEFAULT_DEVICE_PORT;
        res = await syncZkDirectToDatabase(ip, port, db, options);
      } else {
        const targetPath = options.path || DEFAULT_MDB_PATH;
        res = await syncZkToDatabase(targetPath, db, options);
      }
      
      // Notify clients of data updates
      const { dbEvents } = require('./index.cjs');
      dbEvents.emit('change', 'hr_attendance_logs');
      if (res.upsertedUsersCount > 0 || res.purgedUsersCount > 0 || res.deactivatedUsersCount > 0 || options.syncEmployees || options.matchActiveOnly) {
        dbEvents.emit('change', 'hr_employees');
        dbEvents.emit('change', 'hr_shifts');
      }
      
      return res;
    } catch (err) {
      console.error('Error syncing ZK attendance:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('zk-get-stats', async () => {
    try {
      const db = getDb();
      const statsRow = await db.get("SELECT value FROM store WHERE key = 'zk_sync_stats'");
      const lastSyncRow = await db.get("SELECT value FROM store WHERE key = 'zk_last_sync'");
      return {
        success: true,
        data: {
          lastSync: lastSyncRow ? parseJSON(lastSyncRow.value) : null,
          stats: statsRow ? parseJSON(statsRow.value) : null
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // جدولة مزامنة آلية خفيفة في بداية ونهاية الدوام (حركات البصمة فقط)
  let lastAutoSyncDate = '';
  setInterval(async () => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const todayStr = now.toISOString().slice(0, 10);

      // بداية الدوام: 08:30 و 09:15 | نهاية الدوام: 17:15 و 18:00
      const isShiftStart = (hour === 8 && minute >= 30 && minute <= 45) || (hour === 9 && minute >= 15 && minute <= 30);
      const isShiftEnd = (hour === 17 && minute >= 15 && minute <= 30) || (hour === 18 && minute >= 0 && minute <= 15);

      const syncKey = `${todayStr}_${hour}`;
      if ((isShiftStart || isShiftEnd) && lastAutoSyncDate !== syncKey) {
        lastAutoSyncDate = syncKey;
        console.log(`[ZK Auto-Sync] Triggering scheduled attendance punch sync at ${now.toLocaleTimeString('ar-LY')}...`);
        const db = getDb();
        // مزامنة حركات البصمات فقط (logsOnly: true) دون المساس بالموظفين نهائياً
        const res = await syncZkDirectToDatabase(DEFAULT_DEVICE_IP, DEFAULT_DEVICE_PORT, db, { logsOnly: true, fullSync: false });
        if (res.success) {
          const { dbEvents } = require('./index.cjs');
          dbEvents.emit('change', 'hr_attendance_logs');
          console.log(`[ZK Auto-Sync] Completed: ${res.insertedLogsCount} new punches synced.`);
        }
      }
    } catch (e) {
      // Ignore background sync errors gracefully
    }
  }, 10 * 60 * 1000); // يفحص كل 10 دقائق

}

module.exports = { registerIpcHandlers };