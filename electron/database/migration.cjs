const fs = require('fs');

async function runMigrationIfNeeded(db, jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    return false; // No old DB to migrate
  }

  // Check if already migrated
  const row = await db.get('SELECT COUNT(*) as count FROM customers');
  if (row && row.count > 0) {
    return false;
  }

  console.log('Starting Migration from JSON to SQLite (Async)...');
  
  try {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const dbData = JSON.parse(rawData);

    // Run in transaction using BEGIN and COMMIT
    await db.exec('BEGIN TRANSACTION');

    try {
      // 1. Customers
      if (dbData.shams_customers) {
        const stmt = await db.prepare('INSERT INTO customers (id, name, phone, notes) VALUES (?, ?, ?, ?)');
        for (const c of dbData.shams_customers) {
          await stmt.run(c.id, c.name, c.phone || null, c.notes || null);
        }
        await stmt.finalize();
      }

      // 2. Drivers
      if (dbData.shams_drivers) {
        const stmt = await db.prepare('INSERT INTO drivers (id, name, phone, truckNumber, license, trailerNumber) VALUES (?, ?, ?, ?, ?, ?)');
        for (const d of dbData.shams_drivers) {
          await stmt.run(d.id, d.name, d.phone || null, d.truckNumber || null, d.license || null, d.trailerNumber || null);
        }
        await stmt.finalize();
      }

      // 3. Materials
      if (dbData.shams_masterMaterials) {
        const stmt = await db.prepare('INSERT INTO master_materials (id, name, shortName, defaultPrice, unit) VALUES (?, ?, ?, ?, ?)');
        for (const m of dbData.shams_masterMaterials) {
          await stmt.run(m.id, m.name, m.shortName || null, m.defaultPrice || 0, m.unit || '');
        }
        await stmt.finalize();
      }

      // 4. WorksOf
      if (dbData.shams_worksOf) {
        const stmt = await db.prepare('INSERT INTO works_of (id, name) VALUES (?, ?)');
        for (const w of dbData.shams_worksOf) {
          await stmt.run(w.id, w.name);
        }
        await stmt.finalize();
      }

      // 5. Master Items
      if (dbData.shams_masterItems) {
        const stmt = await db.prepare('INSERT INTO master_items (id, worksOfId, name) VALUES (?, ?, ?)');
        for (const i of dbData.shams_masterItems) {
          await stmt.run(i.id, i.worksOfId, i.name);
        }
        await stmt.finalize();
      }

      // 6. Estimate Categories
      if (dbData.shams_estimateCategories) {
        const stmt = await db.prepare('INSERT INTO estimate_categories (id, name) VALUES (?, ?)');
        for (const c of dbData.shams_estimateCategories) {
          await stmt.run(c.id, c.name);
        }
        await stmt.finalize();
      }

      // 7. Estimates
      if (dbData.shams_estimates) {
        const stmt = await db.prepare('INSERT INTO estimates (id, date, desc, chassis, length, width, height, sellPrice, totalCost, profitPercentage, categoryId, materials, specs, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const e of dbData.shams_estimates) {
          await stmt.run(
            e.id, e.date, e.desc, e.chassis, String(e.length), String(e.width), String(e.height), 
            e.sellPrice || 0, e.totalCost || 0, e.profitPercentage || 0, e.categoryId || null, 
            JSON.stringify(e.materials || []), JSON.stringify(e.specs || []), JSON.stringify(e.attachments || [])
          );
        }
        await stmt.finalize();
      }

      // 8. Work Orders
      if (dbData.shams_workOrders) {
        const stmt = await db.prepare('INSERT INTO work_orders (id, date, customerName, items) VALUES (?, ?, ?, ?)');
        for (const w of dbData.shams_workOrders) {
          await stmt.run(w.id, w.date, w.customerName || null, JSON.stringify(w.items || []));
        }
        await stmt.finalize();
      }

      // 9. Invoices
      if (dbData.shams_invoices) {
        const stmt = await db.prepare('INSERT INTO invoices (id, date, customerName, customerId, type, items, total, discount, netTotal, notes, terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const inv of dbData.shams_invoices) {
          await stmt.run(inv.id, inv.date, inv.customerName, inv.customerId || null, inv.type, JSON.stringify(inv.items || []), inv.total || 0, inv.discount || 0, inv.netTotal || 0, inv.notes || null, inv.terms || null);
        }
        await stmt.finalize();
      }

      // 10. Deleted Invoices
      if (dbData.shams_deletedInvoices) {
        const stmt = await db.prepare('INSERT INTO deleted_invoices (id, date, customerName, customerId, type, items, total, discount, netTotal, notes, terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const inv of dbData.shams_deletedInvoices) {
          await stmt.run(inv.id, inv.date, inv.customerName, inv.customerId || null, inv.type, JSON.stringify(inv.items || []), inv.total || 0, inv.discount || 0, inv.netTotal || 0, inv.notes || null, inv.terms || null);
        }
        await stmt.finalize();
      }

      // 11. Letters
      if (dbData.shams_letters) {
        const stmt = await db.prepare('INSERT INTO letters (id, date, to_name, subject, blocks, isArchived) VALUES (?, ?, ?, ?, ?, ?)');
        for (const l of dbData.shams_letters) {
          await stmt.run(l.id, l.date, l.to, l.subject, JSON.stringify(l.blocks || []), l.isArchived ? 1 : 0);
        }
        await stmt.finalize();
      }

      // 12. Shipping Orders
      if (dbData.shams_shippingOrders) {
        const stmt = await db.prepare('INSERT INTO shipping_orders (id, date, destination, data) VALUES (?, ?, ?, ?)');
        for (const s of dbData.shams_shippingOrders) {
          await stmt.run(s.id, s.date, s.destination || null, JSON.stringify(s));
        }
        await stmt.finalize();
      }

      // 13. Settings & Misc (Save remaining state into the store table)
      const storeStmt = await db.prepare('INSERT INTO store (key, value) VALUES (?, ?)');
      const storeKeys = [
        'shams_appSettings', 'shams_savedNotes', 'shams_savedTerms', 'shams_activeTab', 'shams_cart'
      ];
      for (const k of storeKeys) {
        if (dbData[k] !== undefined) {
          await storeStmt.run(k, JSON.stringify(dbData[k]));
        }
      }
      await storeStmt.finalize();

      await db.exec('COMMIT');
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }

    // Verify Counts before archiving
    let countsValid = true;
    if (dbData.shams_customers) {
      const dbCount = await db.get('SELECT COUNT(*) as c FROM customers');
      if (dbCount.c !== dbData.shams_customers.length) countsValid = false;
    }
    if (dbData.shams_invoices) {
      const dbCount = await db.get('SELECT COUNT(*) as c FROM invoices');
      if (dbCount.c !== dbData.shams_invoices.length) countsValid = false;
    }

    if (countsValid) {
      console.log('Migration verified! Counts match. Archiving old JSON...');
      fs.renameSync(jsonPath, jsonPath.replace('.json', '_BACKUP.json'));
      return true;
    } else {
      console.error('Migration failed: count mismatch. Rollback performed.');
      return false;
    }

  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

module.exports = { runMigrationIfNeeded };
