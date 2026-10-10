const fs = require('fs');

// 1. schema.cjs - Add worksOfIds to master_materials
let schema = fs.readFileSync('electron/database/schema.cjs', 'utf8');
if (!schema.includes('ALTER TABLE master_materials ADD COLUMN worksOfIds')) {
  schema = schema.replace('// Add orderIndex', 
`  try { await db.exec("ALTER TABLE master_materials ADD COLUMN worksOfIds TEXT"); } catch(e) {}
  // Add orderIndex`);
  fs.writeFileSync('electron/database/schema.cjs', schema);
}

// 2. ipcHandlers.cjs - Update db-bulk-upsert
let ipc = fs.readFileSync('electron/database/ipcHandlers.cjs', 'utf8');

// Update master_materials upsert
ipc = ipc.replace(
  /INSERT OR REPLACE INTO master_materials \(id, name, shortName, defaultPrice, unit\) VALUES \(\?, \?, \?, \?, \?\)/g,
  'INSERT OR REPLACE INTO master_materials (id, name, shortName, defaultPrice, unit, worksOfIds) VALUES (?, ?, ?, ?, ?, ?)'
);
ipc = ipc.replace(
  /for \(const m of items\) await stmt\.run\(m\.id, m\.name, m\.shortName \|\| null, m\.defaultPrice \|\| 0, m\.unit \|\| ''\);/g,
  "for (const m of items) await stmt.run(m.id, m.name, m.shortName || null, m.defaultPrice || 0, m.unit || '', JSON.stringify(m.worksOfIds || []));"
);

// Update letters upsert (already done? No, we didn't patch letters yet)
ipc = ipc.replace(
  /for \(const l of items\) await stmt\.run\(l\.id, l\.date, l\.to, l\.subject, JSON\.stringify\(l\.blocks \|\| \[\]\), l\.isArchived \? 1 : 0\);/g,
  "for (const l of items) await stmt.run(l.id, l.date, l.to || l.customerName || null, l.subject, JSON.stringify(l.blocks || []), l.isArchived ? 1 : 0);"
);

// 3. ipcHandlers.cjs - Update db-get-collection parsing
// We need to parseJSON for master_materials worksOfIds!
if (!ipc.includes(`table === 'master_materials'`)) {
  ipc = ipc.replace(
    /if \(table === 'estimates'\)/g,
    `if (table === 'master_materials') {\n          row.worksOfIds = parseJSON(row.worksOfIds) || [];\n        } else if (table === 'estimates')`
  );
}

fs.writeFileSync('electron/database/ipcHandlers.cjs', ipc);
console.log('Database handlers patched successfully!');
