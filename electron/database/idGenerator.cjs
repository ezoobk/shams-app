/**
 * electron/database/idGenerator.cjs
 *
 * توليد وحجز الأرقام التسلسلية ذرياً (Atomic Server-Side ID Generation).
 * يضمن:
 * 1. عدم تكرار الأرقام تحت أي ظرف بين الأجهزة المختلفة عبر Promise Mutex.
 * 2. قراءة وفحص قاعدة البيانات SQLite مباشرة ومطابقتها مع أعلى رقم موجود.
 * 3. زيادة العداد وحفظه في جدول store فورياً قبل إعادة النتيجة.
 * 4. إشعار جميع الأجهزة المتصلة بالتحديث عبر dbEvents.
 */

const { getDb, dbEvents } = require('./index.cjs');

let idMutex = Promise.resolve();

async function generateNextId(params) {
  const { type, customerName = '', extraText = '', yearOverride } = params || {};

  return idMutex = idMutex.then(async () => {
    const db = getDb();
    const currentYear = new Date().getFullYear();
    const targetYear = yearOverride || currentYear;

    let actualType = type;
    if (type === 'invP' || type === 'invF' || type === 'invTech' || type === 'إنتاجية' || type === 'shp' || type === 'letter') actualType = 'ref';
    if (type === 'pinv') actualType = 'pinv';

    // 1. Fetch current counters from store
    const storeRow = await db.get("SELECT value FROM store WHERE key = 'shams_idCounters'");
    let counters = { ref: 1, pinv: 1, wo: 1, sn: 1, inv: 1 };
    if (storeRow && storeRow.value) {
      try {
        counters = { ...counters, ...JSON.parse(storeRow.value) };
      } catch (e) {
        console.error('[idGenerator] Error parsing store counters:', e);
      }
    }

    // 2. Scan max from respective table to guarantee no regression or overlap
    let maxFound = 0;
    if (actualType === 'ref') {
      const invRows = await db.all("SELECT id FROM invoices");
      const letRows = await db.all("SELECT id FROM letters");
      const shpRows = await db.all("SELECT id FROM shipping_orders");
      for (const row of invRows) {
        if (!row?.id || row.id.includes('PINV')) continue;
        const m = String(row.id).match(/^Ref-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxFound) maxFound = n;
        }
      }
      for (const row of letRows) {
        if (!row?.id) continue;
        const m = String(row.id).match(/^Ref-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxFound) maxFound = n;
        }
      }
      for (const row of shpRows) {
        if (!row?.id) continue;
        const m = String(row.id).match(/^Ref-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxFound) maxFound = n;
        }
      }
    } else if (actualType === 'pinv') {
      const pinvRows = await db.all("SELECT id FROM purchase_invoices");
      for (const row of pinvRows) {
        if (!row?.id) continue;
        const m = String(row.id).match(/^Ref-(\d+)-PINV/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxFound) maxFound = n;
        }
      }
    } else if (actualType === 'wo') {
      const woRows = await db.all("SELECT id FROM work_orders");
      for (const row of woRows) {
        if (!row?.id) continue;
        const m = String(row.id).match(/^WO-\d+-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxFound) maxFound = n;
        }
      }
    } else if (actualType === 'sn') {
      const woRows = await db.all("SELECT items FROM work_orders");
      for (const row of woRows) {
        try {
          const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
          if (Array.isArray(items)) {
            for (const it of items) {
              if (it?.serialNumber) {
                const snStr = String(it.serialNumber);
                const m = snStr.match(/^SN-\d+-(\d+)/i);
                const n = m ? parseInt(m[1], 10) : parseInt(snStr, 10);
                if (!isNaN(n) && n > maxFound) maxFound = n;
              }
            }
          }
        } catch (e) {}
      }
    }

    let seq = counters[actualType];
    if (typeof seq !== 'number' || isNaN(seq) || seq < 1) seq = 1;
    if (seq <= maxFound) seq = maxFound + 1;

    // Increment and save atomically to database
    counters[actualType] = seq + 1;
    await db.run("INSERT OR REPLACE INTO store (key, value) VALUES ('shams_idCounters', ?)", JSON.stringify(counters));

    // Notify all clients and Electron process
    dbEvents.emit('change', 'shams_idCounters');

    // Format the generated ID
    const pad = seq.toString().padStart(3, '0');
    const safeCustomerClean = (customerName || '').replace(/[\/\\:*?"<>|]/g, '').trim();
    const safeCustomer = safeCustomerClean ? '-' + safeCustomerClean + '-' : '-';

    let generatedId = '';
    if (type === 'pinv') {
      const safeSupplierClean = (customerName || '').replace(/[\/\\:*?"<>|]/g, '').trim();
      generatedId = safeSupplierClean
        ? `Ref-${pad}-PINV-${targetYear}-${safeSupplierClean}`.replace(/--+/g, '-')
        : `Ref-${pad}-PINV-${targetYear}`;
    } else if (type === 'letter') {
      const safeExtraClean = (extraText || '').replace(/[\/\\:*?"<>|]/g, '').trim();
      generatedId = `Ref-${pad}-${safeCustomerClean || 'بدون_اسم'}-${safeExtraClean || 'رسالة'}-${targetYear}`.replace(/--+/g, '-');
    } else if (type === 'invP') {
      generatedId = `Ref-${pad}-INV-P${safeCustomer}${targetYear}`;
    } else if (type === 'invF') {
      generatedId = `Ref-${pad}-INV-F${safeCustomer}${targetYear}`;
    } else if (type === 'invTech' || type === 'إنتاجية') {
      generatedId = `Ref-${pad}-INV-T${safeCustomer}${targetYear}`;
    } else if (type === 'shp') {
      generatedId = `Ref-${pad}-SHP${safeCustomer}${targetYear}`;
    } else {
      const pad4 = seq.toString().padStart(4, '0');
      if (type === 'wo') generatedId = `WO-${targetYear}-${pad4}`;
      else if (type === 'sn') generatedId = `SN-${targetYear}-${pad4}`;
      else generatedId = pad4;
    }

    return { success: true, id: generatedId, seq, counters };
  }).catch(err => {
    console.error('[idGenerator] Error generating next ID:', err);
    return { success: false, error: err.message || 'فشل توليد الرقم التسلسلي' };
  });
}

module.exports = { generateNextId };
