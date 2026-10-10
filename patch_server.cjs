const fs = require('fs');

let server = fs.readFileSync('electron/server.cjs', 'utf8');

// Update master_materials upsert
server = server.replace(
  /INSERT OR REPLACE INTO master_materials \(id, name, shortName, defaultPrice, unit\) VALUES \(\?, \?, \?, \?, \?\)/g,
  'INSERT OR REPLACE INTO master_materials (id, name, shortName, defaultPrice, unit, worksOfIds) VALUES (?, ?, ?, ?, ?, ?)'
);
server = server.replace(
  /for \(const m of items\) await stmt\.run\(m\.id, m\.name, m\.shortName \|\| null, m\.defaultPrice \|\| 0, m\.unit \|\| ''\);/g,
  "for (const m of items) await stmt.run(m.id, m.name, m.shortName || null, m.defaultPrice || 0, m.unit || '', JSON.stringify(m.worksOfIds || []));"
);

// Update letters upsert
server = server.replace(
  /for \(const l of items\) await stmt\.run\(l\.id, l\.date, l\.to, l\.subject, JSON\.stringify\(l\.blocks \|\| \[\]\), l\.isArchived \? 1 : 0\);/g,
  "for (const l of items) await stmt.run(l.id, l.date, l.to || l.customerName || null, l.subject, JSON.stringify(l.blocks || []), l.isArchived ? 1 : 0);"
);

// Update hydrateRows for master_materials
if (!server.includes(`table === 'master_materials'`)) {
  server = server.replace(
    /if \(table === 'estimates'\)/g,
    `if (table === 'master_materials') {\n      row.worksOfIds = parseJSON(row.worksOfIds) || [];\n    } else if (table === 'estimates')`
  );
}

fs.writeFileSync('electron/server.cjs', server);
console.log('Server patched successfully!');
